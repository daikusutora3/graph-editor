import type { GraphModel, GraphNode } from "../../core/graph/model";
import type {
  computeEdgeRouting,
  EdgeRoutingMeta,
} from "../../core/layout/edge-routing";
import { normalizeLoopStepSize } from "../../core/layout/edge-routing-loops";
import { nodeGeometryWidth, NODE_SIZE_PX } from "../../core/graph/node-size";
import {
  edgeCurveSegments,
  edgeCurveSvgPath,
  type EdgeCurvePoint,
  type QuadraticCurveSegment,
} from "../../core/layout/edge-route-geometry";
import {
  previewCurveBounds,
  type PreviewCurvePoints,
} from "./preview-curve-bounds";
import { EDGE_WIDTH, NODE_BORDER_WIDTH } from "../../core/view/graph-paint";
import { clipPreviewEdgeAtTarget } from "./preview-edge-clip";
import { previewArrowVertices } from "./preview-arrow";

function previewNodeWidth(model: GraphModel, node: GraphNode) {
  return model.settings.showNodeLabels ? nodeGeometryWidth(node) : NODE_SIZE_PX;
}

export function createPreviewEdgePath({
  directed,
  isLoop = false,
  radius,
  routing,
  scale,
  source,
  target,
  targetWidth = radius * 2,
}: {
  directed: boolean;
  /** Endpoint identity decides loops; coincident distinct vertices do not. */
  isLoop?: boolean;
  radius: number;
  routing?: {
    bowPx: number;
    controlPointDistancesPx?: readonly number[];
    controlPointWeights?: readonly number[];
    loopDirectionDeg: number;
    loopSweepDeg: number;
    loopStepSizePx?: number;
  };
  scale: number;
  source: { x: number; y: number };
  target: { x: number; y: number };
  targetWidth?: number;
}) {
  if (isLoop) {
    return createLoopPath(source, radius, scale, routing);
  }

  const curve = {
    controlPointDistancesPx: (
      routing?.controlPointDistancesPx ?? [routing?.bowPx ?? 0]
    ).map((distance) => distance * scale),
    controlPointWeights: routing?.controlPointWeights ?? [0.5],
  };
  if (!directed) return edgeCurveSvgPath(source, target, curve);
  const segments = clippedPreviewSegments(
    source,
    target,
    curve,
    targetWidth,
    radius,
  );
  return [
    `M${round(source.x)} ${round(source.y)}`,
    ...segments.map(
      ({ control, end }) =>
        `Q${round(control.x)} ${round(control.y)} ${round(end.x)} ${round(end.y)}`,
    ),
  ].join("");
}

function clippedPreviewSegments(
  source: { x: number; y: number },
  target: { x: number; y: number },
  curve: {
    controlPointDistancesPx: readonly number[];
    controlPointWeights: readonly number[];
  },
  targetWidth: number,
  radius: number,
) {
  const original = edgeCurveSegments(source, target, curve);
  return clipPreviewEdgeAtTarget(straightFallback(original, source, target), {
    centre: target,
    width: targetWidth,
    height: radius * 2,
  });
}

function createLoopPath(
  source: { x: number; y: number },
  radius: number,
  scale: number,
  routing:
    | {
        loopDirectionDeg: number;
        loopSweepDeg: number;
        loopStepSizePx?: number;
      }
    | undefined,
) {
  const { start, end, controlA, controlB } = createLoopGeometry(
    source,
    radius,
    scale,
    routing,
  );
  return [
    `M${round(start.x)} ${round(start.y)}`,
    `C${round(controlA.x)} ${round(controlA.y)}`,
    `${round(controlB.x)} ${round(controlB.y)}`,
    `${round(end.x)} ${round(end.y)}`,
  ].join(" ");
}

function createLoopGeometry(
  source: { x: number; y: number },
  radius: number,
  scale: number,
  routing:
    | {
        loopDirectionDeg: number;
        loopSweepDeg: number;
        loopStepSizePx?: number;
      }
    | undefined,
) {
  const direction = (((routing?.loopDirectionDeg ?? -45) - 90) * Math.PI) / 180;
  const sweep = ((routing?.loopSweepDeg ?? 70) * Math.PI) / 180;
  const stepSize = normalizeLoopStepSize(routing?.loopStepSizePx);
  // Keep gallery icons readable while larger loops fit their reserved bounds.
  const loopRadius = Math.max(
    radius * 1.5,
    Math.min(radius * 3 * (stepSize / 40), 1.4 * stepSize * scale),
  );
  const startAngle = direction - sweep / 2;
  const endAngle = direction + sweep / 2;
  const start = {
    x: source.x + Math.cos(startAngle) * radius,
    y: source.y + Math.sin(startAngle) * radius,
  };
  const end = {
    x: source.x + Math.cos(endAngle) * radius,
    y: source.y + Math.sin(endAngle) * radius,
  };
  const controlA = {
    x: source.x + Math.cos(startAngle) * loopRadius,
    y: source.y + Math.sin(startAngle) * loopRadius,
  };
  const controlB = {
    x: source.x + Math.cos(endAngle) * loopRadius,
    y: source.y + Math.sin(endAngle) * loopRadius,
  };

  return { start, end, controlA, controlB };
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

export type PreviewGeometryWork = {
  nodeIndexBuilds: number;
  nodeWidthReads: number;
  edgeSegmentBuilds: number;
  targetClips: number;
  loopBuilds: number;
};

type PreparedPreviewEdge = {
  source: GraphNode;
  target: GraphNode;
  routing?: EdgeRoutingMeta;
  segments: readonly QuadraticCurveSegment[];
  clippedSegments?: readonly QuadraticCurveSegment[];
  loop?: ReturnType<typeof createLoopGeometry>;
};

type PreviewBounds = {
  minX: number;
  minY: number;
  width: number;
  height: number;
};

export type PreparedPreviewGeometry = {
  nodeById: Map<string, GraphNode>;
  nodeWidths: Map<string, number>;
  edgeById: Map<string, PreparedPreviewEdge>;
  modelBounds: PreviewBounds;
  paintBounds: PreviewBounds;
};

/** Prepare model-space curves once for fit bounds, arrows and SVG rendering. */
export function preparePreviewGeometry(
  model: GraphModel,
  routes: ReturnType<typeof computeEdgeRouting>,
  editorLike: boolean,
  radiusScale = 1,
  work?: PreviewGeometryWork,
): PreparedPreviewGeometry {
  const nodeById = new Map<string, GraphNode>();
  const nodeWidths = new Map<string, number>();
  const edgeById = new Map<string, PreparedPreviewEdge>();
  if (work) work.nodeIndexBuilds++;
  for (const node of model.nodes) {
    nodeById.set(node.id, node);
    nodeWidths.set(node.id, previewNodeWidth(model, node));
    if (work) work.nodeWidthReads++;
  }
  const radius = (NODE_SIZE_PX / 2) * (editorLike ? radiusScale : 1);
  for (const edge of model.edges) {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) continue;
    const routing = routes.get(edge.id);
    const prepared: PreparedPreviewEdge = {
      source,
      target,
      routing,
      segments: [],
    };
    if (edge.source === edge.target) {
      prepared.loop = createLoopGeometry(source, radius, 1, routing);
      if (work) work.loopBuilds++;
    } else {
      prepared.segments = edgeCurveSegments(source, target, {
        controlPointDistancesPx: routing?.controlPointDistancesPx ?? [
          routing?.bowPx ?? 0,
        ],
        controlPointWeights: routing?.controlPointWeights ?? [0.5],
      });
      if (work) work.edgeSegmentBuilds++;
      if (editorLike && model.settings.directed) {
        prepared.clippedSegments = clipPreviewEdgeAtTarget(
          straightFallback(prepared.segments, source, target),
          {
            centre: target,
            width: nodeWidths.get(target.id)!,
            height: radius * 2,
          },
        );
        if (work) work.targetClips++;
      }
    }
    edgeById.set(edge.id, prepared);
  }
  const modelBounds = getPreparedModelBounds(
    model,
    nodeWidths,
    edgeById,
    editorLike,
    radiusScale,
  );
  return {
    nodeById,
    nodeWidths,
    edgeById,
    modelBounds,
    paintBounds: editorLike
      ? getEditorPaintBounds(model, edgeById, modelBounds)
      : modelBounds,
  };
}

function straightFallback(
  segments: readonly QuadraticCurveSegment[],
  source: EdgeCurvePoint,
  target: EdgeCurvePoint,
) {
  return segments.length > 0
    ? segments
    : [
        {
          start: source,
          control: {
            x: (source.x + target.x) / 2,
            y: (source.y + target.y) / 2,
          },
          end: target,
        },
      ];
}

export function createPreparedPreviewEdgePath(
  prepared: PreparedPreviewEdge,
  {
    directed,
    radius,
    scale,
    toPoint,
    editorLike,
    targetWidth,
  }: {
    directed: boolean;
    radius: number;
    scale: number;
    toPoint: (x: number, y: number) => EdgeCurvePoint;
    editorLike: boolean;
    targetWidth: number;
  },
) {
  const transform = (point: EdgeCurvePoint) => toPoint(point.x, point.y);
  const source = transform(prepared.source);
  const target = transform(prepared.target);
  if (prepared.loop) {
    if (!editorLike)
      return createLoopPath(source, radius, scale, prepared.routing);
    const { start, end, controlA, controlB } = prepared.loop;
    const a = transform(start),
      b = transform(controlA),
      c = transform(controlB),
      d = transform(end);
    return [
      `M${round(a.x)} ${round(a.y)}`,
      `C${round(b.x)} ${round(b.y)}`,
      `${round(c.x)} ${round(c.y)}`,
      `${round(d.x)} ${round(d.y)}`,
    ].join(" ");
  }
  let segments = (prepared.clippedSegments ?? prepared.segments).map(
    ({ start, control, end }) => ({
      start: transform(start),
      control: transform(control),
      end: transform(end),
    }),
  );
  if (directed && !editorLike) {
    segments = [
      ...clipPreviewEdgeAtTarget(straightFallback(segments, source, target), {
        centre: target,
        width: targetWidth,
        height: radius * 2,
      }),
    ];
  }
  if (!directed && segments.length === 0)
    return `M${round(source.x)} ${round(source.y)}L${round(target.x)} ${round(target.y)}`;
  return [
    `M${round(source.x)} ${round(source.y)}`,
    ...segments.map(
      ({ control, end }) =>
        `Q${round(control.x)} ${round(control.y)} ${round(end.x)} ${round(end.y)}`,
    ),
  ].join("");
}

function getEditorPaintBounds(
  model: GraphModel,
  edges: Map<string, PreparedPreviewEdge>,
  bounds: PreviewBounds,
) {
  let minX = bounds.minX;
  let maxX = bounds.minX + bounds.width;
  let minY = bounds.minY;
  let maxY = bounds.minY + bounds.height;
  if (model.settings.directed) {
    for (const prepared of edges.values()) {
      let tip, control;
      if (prepared.loop) {
        tip = prepared.loop.end;
        control = prepared.loop.controlB;
      } else {
        const segment = prepared.clippedSegments!.at(-1)!;
        tip = segment.end;
        control = segment.control;
      }
      for (const point of previewArrowVertices(
        tip,
        control,
        EDGE_WIDTH * model.settings.arrowScale,
      )) {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
      }
    }
  }
  const strokeMargin = Math.max(NODE_BORDER_WIDTH, EDGE_WIDTH) / 2;
  return {
    minX: minX - strokeMargin,
    minY: minY - strokeMargin,
    width: maxX - minX + strokeMargin * 2,
    height: maxY - minY + strokeMargin * 2,
  };
}

export function getModelBounds(
  model: GraphModel,
  routes: ReturnType<typeof computeEdgeRouting>,
  editorLike: boolean,
  radiusScale = 1,
) {
  return preparePreviewGeometry(model, routes, editorLike, radiusScale)
    .modelBounds;
}

function getPreparedModelBounds(
  model: GraphModel,
  nodeWidths: Map<string, number>,
  edges: Map<string, PreparedPreviewEdge>,
  editorLike: boolean,
  radiusScale: number,
) {
  if (model.nodes.length === 0) {
    return { minX: -1, minY: -1, width: 2, height: 2 };
  }

  // The paste preview includes labels, so fit the whole pill and scale its
  // text with it. Fitting only node centres clips long labels at the frame.
  const xs = model.nodes.flatMap((node) =>
    editorLike
      ? [
          node.x - nodeWidths.get(node.id)! / 2,
          node.x + nodeWidths.get(node.id)! / 2,
        ]
      : [node.x],
  );
  const ys = model.nodes.flatMap((node) =>
    editorLike
      ? [
          node.y - (NODE_SIZE_PX / 2) * radiusScale,
          node.y + (NODE_SIZE_PX / 2) * radiusScale,
        ]
      : [node.y],
  );
  for (const prepared of edges.values()) {
    const node = prepared.source;
    if (prepared.loop) {
      const loop = prepared.loop;
      includeCurve([loop.start, loop.controlA, loop.controlB, loop.end]);
      if (!editorLike) {
        // Gallery nodes stay a fixed screen size. Keep the existing roomy loop
        // reservation; their radius is independent of the graph fit scale.
        xs.push(
          node.x - nodeGeometryWidth(node) / 2,
          node.x + nodeGeometryWidth(node) / 2,
          loop.controlA.x,
          loop.controlB.x,
        );
        ys.push(
          node.y - NODE_SIZE_PX / 2,
          node.y + NODE_SIZE_PX / 2,
          loop.controlA.y,
          loop.controlB.y,
        );
      }
      continue;
    }
    for (const { start, control, end: segmentEnd } of prepared.segments) {
      includeCurve([start, control, segmentEnd]);
    }
  }
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    minX,
    minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };

  function includeCurve(points: PreviewCurvePoints) {
    const curveBounds = previewCurveBounds(points);
    xs.push(curveBounds.minX, curveBounds.maxX);
    ys.push(curveBounds.minY, curveBounds.maxY);
  }
}
