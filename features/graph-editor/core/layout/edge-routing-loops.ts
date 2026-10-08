import type { ResolvedEdgeRoutingOptions } from "./edge-routing-shared";
/** Self-loop placement: picks the direction with the most free space. */
import type { GraphNode, GraphEdge, EdgeId } from "../graph/model";
import {
  nodeGeometryWidth,
  NODE_SIZE_PX,
  pillExtentTowards,
} from "../graph/node-size";
import { normalizeEdgeRoutingOverride } from "../graph/edge-routing-overrides";
import { edgeHasVisibleLabel, edgeLabelSize } from "./edge-routing-shared";

export const DEFAULT_LOOP_STEP_SIZE_PX = 40;
export const MAX_LOOP_STEP_SIZE_PX = 180;
export function normalizeLoopStepSize(value?: number) {
  return Number.isFinite(value)
    ? Math.max(40, Math.min(180, Math.round(value!)))
    : 40;
}
type LoopPlacement = {
  loopDirectionDeg: number;
  loopSweepDeg: number;
  loopStepSizePx?: number;
  status?: "ready" | "unresolved";
};

export function chooseLoopDirection(
  source: GraphNode,
  nodes: GraphNode[],
  options: ResolvedEdgeRoutingOptions,
) {
  const task = createLoopDirectionTask(source, nodes, options);
  let step = task.next();
  while (!step.done) step = task.next();
  return step.value;
}

/** Rotate evenly spaced loops together so their sectors stay separate. */
export function* createLoopGroupDirectionTask(
  source: GraphNode,
  nodes: GraphNode[],
  options: ResolvedEdgeRoutingOptions,
  count: number,
): Generator<void, number> {
  if (count === 1) {
    return yield* createLoopDirectionTask(source, nodes, options);
  }
  const nearbyNodes = yield* loopObstacleNodes(source, nodes, options);
  if (nearbyNodes.length === 0) return Math.round(options.loopDirectionDeg);
  let best = Math.round(options.loopDirectionDeg);
  let bestScore = Infinity;
  for (const candidate of loopDirectionCandidates(options)) {
    let score = 0;
    for (let index = 0; index < count; index++) {
      yield;
      const direction = candidate + (index * 360) / count;
      score += yield* scoreLoopDirectionTask(direction, source, nearbyNodes, {
        ...options,
        loopDirectionDeg: options.loopDirectionDeg + (index * 360) / count,
      });
    }
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

/** Keep each direction resumable without rescoring distant nodes 24 times. */
export function* createLoopDirectionTask(
  source: GraphNode,
  nodes: GraphNode[],
  options: ResolvedEdgeRoutingOptions,
): Generator<void, number> {
  if (!options.avoidNodes) {
    return options.loopDirectionDeg;
  }

  const nearbyNodes = yield* loopObstacleNodes(source, nodes, options);
  if (nearbyNodes.length === 0) return Math.round(options.loopDirectionDeg);
  const candidates = loopDirectionCandidates(options);
  let best = candidates[0] ?? options.loopDirectionDeg;
  let bestScore = yield* scoreLoopDirectionTask(
    best,
    source,
    nearbyNodes,
    options,
  );

  for (const candidate of candidates.slice(1)) {
    yield;
    const score = yield* scoreLoopDirectionTask(
      candidate,
      source,
      nearbyNodes,
      options,
    );

    if (
      score < bestScore ||
      (score === bestScore &&
        Math.abs(candidate - options.loopDirectionDeg) <
          Math.abs(best - options.loopDirectionDeg))
    ) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

function* loopObstacleNodes(
  source: GraphNode,
  nodes: GraphNode[],
  options: ResolvedEdgeRoutingOptions,
) {
  const radius = options.nodeClearancePx * 1.7;
  // Every sample lies on this circle. Only nodes within its clearance annulus
  // can contribute a score. Keep floating-point slack for translated drawings
  // where adding the radius to a large coordinate can lose precision.
  const slack =
    Number.EPSILON *
    Math.max(1, Math.abs(source.x), Math.abs(source.y), radius) *
    8;
  const outer = radius + options.nodeClearancePx + slack;
  const inner = Math.max(0, radius - options.nodeClearancePx - slack);
  const outerSquared = outer * outer;
  const innerSquared = inner * inner;

  const nearby: GraphNode[] = [];
  for (const [index, node] of nodes.entries()) {
    if (index % 64 === 0) yield;
    options.work.units++;
    if (node.id === source.id) continue;
    const dx = node.x - source.x;
    const dy = node.y - source.y;
    const squaredDistance = dx * dx + dy * dy;
    if (squaredDistance <= outerSquared && squaredDistance >= innerSquared)
      nearby.push(node);
  }
  return nearby;
}
export function loopDirectionCandidates(options: ResolvedEdgeRoutingOptions) {
  return Array.from({ length: 24 }, (_, index) =>
    Math.round(options.loopDirectionDeg + index * 15),
  );
}
export function scoreLoopDirection(
  directionDeg: number,
  source: GraphNode,
  nodes: GraphNode[],
  options: ResolvedEdgeRoutingOptions,
) {
  const task = scoreLoopDirectionTask(directionDeg, source, nodes, options);
  let step = task.next();
  while (!step.done) step = task.next();
  return step.value;
}
function* scoreLoopDirectionTask(
  directionDeg: number,
  source: GraphNode,
  nodes: GraphNode[],
  options: ResolvedEdgeRoutingOptions,
): Generator<void, number> {
  const loopPoints = loopSamplePoints(source, directionDeg, options);
  const slack =
    Number.EPSILON * Math.max(1, Math.abs(source.x), Math.abs(source.y)) * 8;
  const reach = options.nodeClearancePx + slack;
  const minX = Math.min(...loopPoints.map((point) => point.x)) - reach;
  const maxX = Math.max(...loopPoints.map((point) => point.x)) + reach;
  const minY = Math.min(...loopPoints.map((point) => point.y)) - reach;
  const maxY = Math.max(...loopPoints.map((point) => point.y)) + reach;
  let score =
    Math.abs(normalizeDegrees(directionDeg - options.loopDirectionDeg)) * 0.01;

  for (const [index, node] of nodes.entries()) {
    if (index % 32 === 0) yield;
    if (node.id === source.id) continue;
    options.work.units++;
    if (node.x < minX || node.x > maxX || node.y < minY || node.y > maxY)
      continue;

    let distance = Infinity;
    for (const point of loopPoints) {
      options.work.units++;
      distance = Math.min(
        distance,
        Math.hypot(node.x - point.x, node.y - point.y),
      );
    }
    const overlap = Math.max(0, options.nodeClearancePx - distance);
    score += overlap * overlap;
  }

  return score;
}
export function loopSamplePoints(
  source: GraphNode,
  directionDeg: number,
  options: ResolvedEdgeRoutingOptions,
) {
  // Cytoscape measures loop-direction from 12 o'clock, while Math.cos/sin
  // measure from 3 o'clock. Match the renderer before scoring obstacles.
  const direction = ((directionDeg - 90) * Math.PI) / 180;
  const sweep = (options.loopSweepDeg * Math.PI) / 180;
  const radius = options.nodeClearancePx * 1.7;

  return Array.from({ length: 7 }, (_, index) => {
    const t = index / 6;
    const angle = direction - sweep / 2 + sweep * t;

    return {
      x: source.x + Math.cos(angle) * radius,
      y: source.y + Math.sin(angle) * radius,
    };
  });
}
export function normalizeDegrees(value: number) {
  return ((((value + 180) % 360) + 360) % 360) - 180;
}

/** Sector placement and native loop sizing, independent of the avoidance toggle. */
export function* createLoopGroupRoutingTask(
  source: GraphNode,
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: ResolvedEdgeRoutingOptions,
  provisional = false,
): Generator<void, Map<EdgeId, LoopPlacement>> {
  const fixed = new Map<EdgeId, LoopPlacement>();
  const automatic: GraphEdge[] = [];
  for (const edge of edges) {
    const override = normalizeEdgeRoutingOverride(edge.routing);
    if (
      override?.loopDirectionDeg !== undefined ||
      override?.loopSweepDeg !== undefined
    ) {
      fixed.set(edge.id, {
        loopDirectionDeg: override.loopDirectionDeg ?? options.loopDirectionDeg,
        loopSweepDeg: override.loopSweepDeg ?? options.loopSweepDeg,
      });
    } else automatic.push(edge);
  }
  if (!automatic.length) return fixed;
  if (edges.length === 1 && nodeGeometryWidth(source) <= NODE_SIZE_PX) {
    const direction = provisional
      ? options.loopDirectionDeg
      : yield* createLoopDirectionTask(source, nodes, options);
    const route = {
      loopDirectionDeg: direction,
      loopSweepDeg: options.loopSweepDeg,
    };
    if (
      provisional ||
      !edgeHasVisibleLabel(automatic[0]!) ||
      !labelTouchesSource(
        source,
        loopLabelPoint(source, route),
        edgeLabelSize(automatic[0]!, options.work),
      )
    )
      return new Map([[automatic[0]!.id, route]]);
    // A long label can cover a circular source too; only clear single loops
    // retain the legacy size/direction fast path.
  }
  const sorted = automatic.toSorted((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  const nearby: GraphNode[] = [];
  if (options.avoidNodes && !provisional) {
    for (const [index, node] of nodes.entries()) {
      if (index % 64 === 0) yield;
      options.work.units++;
      if (
        node.id !== source.id &&
        Math.abs(node.x - source.x) <= 252 + nodeGeometryWidth(node) / 2 + 30 &&
        Math.abs(node.y - source.y) <= 282
      )
        nearby.push(node);
    }
  }
  let best = new Map<EdgeId, LoopPlacement>();
  let bestScore = Infinity;
  // Fixed manual sectors stay anchored; their free arcs do not rotate.
  const candidates =
    provisional || fixed.size
      ? [options.loopDirectionDeg]
      : loopDirectionCandidates(options);
  for (const direction of candidates) {
    yield;
    const layout = allocateLoopSectors(sorted, fixed, options, direction);
    if (provisional) return layout;
    yield* sizeLoopPlacements(source, edges, sorted, layout, options);
    const score = yield* scoreLoopLayout(
      source,
      edges,
      layout,
      nearby,
      options,
    );
    if (score < bestScore) {
      bestScore = score;
      best = layout;
    }
  }
  return best;
}

function allocateLoopSectors(
  automatic: GraphEdge[],
  fixed: Map<EdgeId, LoopPlacement>,
  options: ResolvedEdgeRoutingOptions,
  direction: number,
) {
  const layout = new Map(fixed);
  if (!fixed.size) {
    const spacing = 360 / automatic.length;
    const sweep =
      automatic.length === 1
        ? options.loopSweepDeg
        : Math.max(10, Math.min(options.loopSweepDeg, spacing - 10));
    for (const [index, edge] of automatic.entries())
      layout.set(edge.id, {
        loopDirectionDeg: Math.round(direction + index * spacing),
        loopSweepDeg: sweep,
      });
    return layout;
  }
  const intervals: { start: number; end: number }[] = [];
  for (const route of fixed.values()) {
    const centre = ((route.loopDirectionDeg % 360) + 360) % 360;
    const half = route.loopSweepDeg / 2 + 5;
    const start = centre - half,
      end = centre + half;
    if (start < 0) {
      intervals.push({ start: start + 360, end: 360 }, { start: 0, end });
    } else if (end > 360) {
      intervals.push({ start, end: 360 }, { start: 0, end: end - 360 });
    } else intervals.push({ start, end });
  }
  const merged: { start: number; end: number }[] = [];
  for (const interval of intervals.toSorted((a, b) => a.start - b.start)) {
    const last = merged.at(-1);
    if (last && interval.start <= last.end)
      last.end = Math.max(last.end, interval.end);
    else merged.push({ ...interval });
  }
  const free: { start: number; end: number; count: number }[] = [];
  let end = 0;
  for (const interval of merged) {
    if (interval.start > end)
      free.push({ start: end, end: interval.start, count: 0 });
    end = interval.end;
  }
  if (end < 360) free.push({ start: end, end: 360, count: 0 });
  if (free.length > 1 && free[0]!.start === 0 && free.at(-1)!.end === 360) {
    const first = free.shift()!,
      last = free.at(-1)!;
    last.end = first.end + 360;
  }
  if (!free.length)
    free.push({ start: direction, end: direction + 360, count: 0 });
  for (let i = 0; i < automatic.length; i++) {
    let arc = free[0]!;
    for (const candidate of free)
      if (
        (candidate.end - candidate.start) / (candidate.count + 1) >
        (arc.end - arc.start) / (arc.count + 1)
      )
        arc = candidate;
    arc.count++;
  }
  let index = 0;
  for (const arc of free) {
    const spacing = (arc.end - arc.start) / Math.max(1, arc.count);
    for (let lane = 0; lane < arc.count; lane++) {
      const edge = automatic[index++]!;
      layout.set(edge.id, {
        loopDirectionDeg: Math.round(arc.start + (lane + 0.5) * spacing),
        loopSweepDeg: Math.max(
          10,
          Math.min(options.loopSweepDeg, spacing - 10),
        ),
      });
    }
  }
  return layout;
}

/** Cytoscape's bundled-loop label is the average of two radius1.4*step controls. */
export function loopLabelPoint(
  source: GraphNode,
  route: Pick<
    LoopPlacement,
    "loopDirectionDeg" | "loopSweepDeg" | "loopStepSizePx"
  >,
  bundleIndex = 0,
) {
  const direction = ((route.loopDirectionDeg - 90) * Math.PI) / 180;
  const radius =
    1.4 *
    normalizeLoopStepSize(route.loopStepSizePx) *
    (1 + bundleIndex / 3) *
    Math.cos((route.loopSweepDeg * Math.PI) / 360);
  return {
    x: source.x + Math.cos(direction) * radius,
    y: source.y + Math.sin(direction) * radius,
  };
}
function labelOverlap(
  a: { x: number; y: number },
  aSize: { width: number; height: number },
  b: { x: number; y: number },
  bSize: { width: number; height: number },
) {
  const x = (aSize.width + bSize.width) / 2 + 2 - Math.abs(a.x - b.x);
  const y = (aSize.height + bSize.height) / 2 + 2 - Math.abs(a.y - b.y);
  return x > 0 && y > 0 ? x * y : 0;
}
function labelTouchesSource(
  source: GraphNode,
  point: { x: number; y: number },
  size: { width: number; height: number },
) {
  const a = Math.max(0, nodeGeometryWidth(source) / 2 - NODE_SIZE_PX / 2);
  const dx = Math.max(0, Math.abs(point.x - source.x) - a - size.width / 2 - 4);
  const dy = Math.max(0, Math.abs(point.y - source.y) - size.height / 2 - 4);
  return Math.hypot(dx, dy) < NODE_SIZE_PX / 2;
}
function* sizeLoopPlacements(
  source: GraphNode,
  edges: GraphEdge[],
  automatic: GraphEdge[],
  layout: Map<EdgeId, LoopPlacement>,
  options: ResolvedEdgeRoutingOptions,
): Generator<void> {
  let minimumGap = 360,
    diagonal = 0;
  const automaticIds = new Set(automatic.map((edge) => edge.id));
  const fixedEdges = edges.filter((edge) => !automaticIds.has(edge.id));
  const angles: number[] = [];
  for (const [index, edge] of automatic.entries()) {
    if (index % 64 === 0) yield;
    options.work.units++;
    if (edgeHasVisibleLabel(edge)) {
      const size = edgeLabelSize(edge, options.work);
      diagonal = Math.max(
        diagonal,
        Math.hypot(size.width + 2, size.height + 2),
      );
    }
    angles.push(((layout.get(edge.id)!.loopDirectionDeg % 360) + 360) % 360);
  }
  angles.sort((a, b) => a - b);
  for (let index = 0; index < angles.length; index++) {
    if (index % 64 === 0) yield;
    options.work.units++;
    const angle = angles[index]!,
      next = angles[(index + 1) % angles.length]!;
    minimumGap = Math.min(
      minimumGap,
      index + 1 === angles.length ? next + 360 - angle : next - angle,
    );
  }
  const minimumRadius =
    automatic.length > 1
      ? diagonal / (2 * Math.sin((minimumGap * Math.PI) / 360))
      : 0;
  const halfWidth = nodeGeometryWidth(source) / 2;
  for (const edge of automatic) {
    yield;
    const route = layout.get(edge.id)!;
    const factor = 1.4 * Math.cos((route.loopSweepDeg * Math.PI) / 360);
    let step = Math.max(
      automatic.length >= 8 && diagonal > 0 ? 50 : 40,
      minimumRadius / Math.max(0.01, factor),
    );
    for (const sign of [-1, 1]) {
      const angle =
        ((route.loopDirectionDeg - 90 + (sign * route.loopSweepDeg) / 2) *
          Math.PI) /
        180;
      step = Math.max(
        step,
        (pillExtentTowards(halfWidth, 24, Math.cos(angle), Math.sin(angle)) +
          6) /
          1.4,
      );
    }
    route.loopStepSizePx = Number.isFinite(step)
      ? normalizeLoopStepSize(Math.ceil(step))
      : 180;
    if (step > 180) route.status = "unresolved";
    const size = edgeLabelSize(edge, options.work);
    while (
      edgeHasVisibleLabel(edge) &&
      labelTouchesSource(source, loopLabelPoint(source, route), size) &&
      route.loopStepSizePx < 180
    ) {
      yield;
      options.work.units++;
      route.loopStepSizePx = Math.min(180, route.loopStepSizePx + 4);
    }
    for (const other of fixedEdges) {
      yield;
      options.work.units++;
      if (!edgeHasVisibleLabel(edge) || !edgeHasVisibleLabel(other)) continue;
      const fixed = layout.get(other.id)!;
      while (
        labelOverlap(
          loopLabelPoint(source, route),
          size,
          loopLabelPoint(source, fixed),
          edgeLabelSize(other, options.work),
        ) &&
        route.loopStepSizePx < 180
      ) {
        yield;
        options.work.units++;
        route.loopStepSizePx = Math.min(180, route.loopStepSizePx + 4);
      }
    }
  }
}
function* scoreLoopLayout(
  source: GraphNode,
  edges: GraphEdge[],
  layout: Map<EdgeId, LoopPlacement>,
  nodes: GraphNode[],
  options: ResolvedEdgeRoutingOptions,
): Generator<void, number> {
  const points = new Map<EdgeId, { x: number; y: number }>();
  const bundles = new Map<string, number>();
  let score = 0;
  for (const edge of edges) {
    yield;
    const route = layout.get(edge.id)!;
    const manual =
      edge.routing?.loopDirectionDeg !== undefined ||
      edge.routing?.loopSweepDeg !== undefined;
    const key = `${route.loopDirectionDeg}:${route.loopSweepDeg}`;
    const bundle = bundles.get(key) ?? 0;
    bundles.set(key, bundle + 1);
    const point = loopLabelPoint(source, route, bundle);
    points.set(edge.id, point);
    let collisions = route.status === "unresolved" ? 1 : 0;
    if (!manual) {
      score +=
        (normalizeLoopStepSize(route.loopStepSizePx) - 40) * 0.1 +
        Math.abs(
          normalizeDegrees(route.loopDirectionDeg - options.loopDirectionDeg),
        ) *
          0.001;
      if (
        edgeHasVisibleLabel(edge) &&
        labelTouchesSource(source, point, edgeLabelSize(edge, options.work))
      )
        collisions++;
      const samples = nativeLoopSamplePoints(source, route);
      for (const node of nodes) {
        yield;
        const a = Math.max(0, nodeGeometryWidth(node) / 2 - 24);
        let distance = Infinity;
        for (const sample of samples) {
          options.work.units++;
          distance = Math.min(
            distance,
            Math.hypot(
              Math.max(0, Math.abs(sample.x - node.x) - a),
              sample.y - node.y,
            ),
          );
        }
        if (distance < 30) collisions++;
      }
    }
    route.status = collisions ? "unresolved" : "ready";
    score += collisions * 1_000_000;
  }
  if (edges.length * edges.length <= 4_000_000)
    for (let i = 0; i < edges.length; i++)
      for (let j = 0; j < i; j++) {
        yield;
        options.work.units++;
        const a = edges[i]!,
          b = edges[j]!;
        if (!edgeHasVisibleLabel(a) || !edgeHasVisibleLabel(b)) continue;
        const overlap = labelOverlap(
          points.get(a.id)!,
          edgeLabelSize(a, options.work),
          points.get(b.id)!,
          edgeLabelSize(b, options.work),
        );
        if (overlap) {
          score += 10_000 + overlap;
          if (
            a.routing?.loopDirectionDeg === undefined &&
            a.routing?.loopSweepDeg === undefined
          )
            layout.get(a.id)!.status = "unresolved";
          if (
            b.routing?.loopDirectionDeg === undefined &&
            b.routing?.loopSweepDeg === undefined
          )
            layout.get(b.id)!.status = "unresolved";
        }
      }
  return score;
}
function nativeLoopSamplePoints(source: GraphNode, route: LoopPlacement) {
  const angle = ((route.loopDirectionDeg - 90) * Math.PI) / 180,
    sweep = (route.loopSweepDeg * Math.PI) / 360;
  const radius = 1.4 * normalizeLoopStepSize(route.loopStepSizePx);
  const ray = (theta: number, r: number) => ({
    x: source.x + Math.cos(theta) * r,
    y: source.y + Math.sin(theta) * r,
  });
  const c1 = ray(angle - sweep, radius),
    c2 = ray(angle + sweep, radius);
  const start = ray(
    angle - sweep,
    pillExtentTowards(
      nodeGeometryWidth(source) / 2,
      24,
      Math.cos(angle - sweep),
      Math.sin(angle - sweep),
    ),
  );
  const end = ray(
    angle + sweep,
    pillExtentTowards(
      nodeGeometryWidth(source) / 2,
      24,
      Math.cos(angle + sweep),
      Math.sin(angle + sweep),
    ),
  );
  const mid = { x: (c1.x + c2.x) / 2, y: (c1.y + c2.y) / 2 };
  const points: { x: number; y: number }[] = [];
  for (const [a, c, b] of [
    [start, c1, mid],
    [mid, c2, end],
  ])
    for (let i = 0; i <= 8; i++) {
      const t = i / 8,
        u = 1 - t;
      points.push({
        x: u * u * a!.x + 2 * u * t * c!.x + t * t * b!.x,
        y: u * u * a!.y + 2 * u * t * c!.y + t * t * b!.y,
      });
    }
  return points;
}
