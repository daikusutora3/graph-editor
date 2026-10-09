import type { ResolvedEdgeRoutingOptions } from "./edge-routing-shared";
import { scoreRustLoopObstacles } from "../../compute/wasm-routing";
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
type LoopSize = { width: number; height: number };
type LoopPreparation = {
  sizes: (LoopSize | undefined)[];
  automaticIndexes: number[];
  fixed: { edge: GraphEdge; index: number }[];
  size: (edge: GraphEdge, index: number) => LoopSize;
  extent: (halfWidth: number, angle: number) => number;
};

/** Scratch geometry belongs to one resumable group, never to the graph. */
function prepareLoopGroup(
  edges: GraphEdge[],
  automatic: GraphEdge[],
  options: ResolvedEdgeRoutingOptions,
): LoopPreparation {
  const sizes: (LoopSize | undefined)[] = Array(edges.length);
  const indexes = new Map(edges.map((edge, index) => [edge.id, index]));
  const automaticIds = new Set(automatic.map((edge) => edge.id));
  let cachedWidth = NaN;
  const extents = new Map<number, number>();
  const validateWidth = (halfWidth: number) => {
    if (halfWidth !== cachedWidth) {
      extents.clear();
      cachedWidth = halfWidth;
    }
  };
  return {
    sizes,
    automaticIndexes: automatic.map((edge) => indexes.get(edge.id)!),
    fixed: edges.flatMap((edge, index) =>
      automaticIds.has(edge.id) ? [] : [{ edge, index }],
    ),
    size(edge, index) {
      // Public helpers can omit the task-level label cache. Keep their fresh
      // reads, including edits made while the generator is suspended.
      if (!options.work.labelSizes) return edgeLabelSize(edge, options.work);
      return (sizes[index] ??= edgeLabelSize(edge, options.work));
    },
    extent(halfWidth, angle) {
      if (halfWidth <= 24) return 24;
      // The caller may resume after changing measured source geometry. Exact
      // angle keys retain Math.cos/sin rounding rather than folding by 360°.
      validateWidth(halfWidth);
      const cached = extents.get(angle);
      if (cached !== undefined) return cached;
      const value = pillExtentTowards(
        halfWidth,
        24,
        Math.cos(angle),
        Math.sin(angle),
      );
      // Large public-helper inputs cannot grow this scratch map without bound.
      if (extents.size < 1024) extents.set(angle, value);
      return value;
    },
  };
}

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
  let rustScores: Float64Array | null = null;
  for (const [index, node] of nodes.entries()) {
    if (index % 32 === 0) {
      yield;
      if (index === 0)
        rustScores = scoreRustLoopObstacles(
          nodes,
          loopPoints,
          options.nodeClearancePx,
          { x1: minX, y1: minY, x2: maxX, y2: maxY },
          false,
        );
    }
    if (node.id === source.id) continue;
    if (rustScores) {
      const resultIndex = index * 3;
      options.work.units += rustScores[resultIndex + 1]!;
      score += rustScores[resultIndex]!;
      continue;
    }
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
  let preparation: LoopPreparation | undefined;
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
    preparation ??= prepareLoopGroup(edges, sorted, options);
    yield* sizeLoopPlacements(source, sorted, layout, options, preparation);
    const score = yield* scoreLoopLayout(
      source,
      edges,
      layout,
      nearby,
      options,
      preparation,
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
  automatic: GraphEdge[],
  layout: Map<EdgeId, LoopPlacement>,
  options: ResolvedEdgeRoutingOptions,
  preparation: LoopPreparation,
): Generator<void> {
  let minimumGap = 360,
    diagonal = 0;
  const angles: number[] = [];
  for (const [index, edge] of automatic.entries()) {
    if (index % 64 === 0) yield;
    options.work.units++;
    if (edgeHasVisibleLabel(edge)) {
      const size = preparation.size(edge, preparation.automaticIndexes[index]!);
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
  for (const [index, edge] of automatic.entries()) {
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
      step = Math.max(step, (preparation.extent(halfWidth, angle) + 6) / 1.4);
    }
    route.loopStepSizePx = Number.isFinite(step)
      ? normalizeLoopStepSize(Math.ceil(step))
      : 180;
    if (step > 180) route.status = "unresolved";
    const size = preparation.size(edge, preparation.automaticIndexes[index]!);
    while (
      edgeHasVisibleLabel(edge) &&
      labelTouchesSource(source, loopLabelPoint(source, route), size) &&
      route.loopStepSizePx < 180
    ) {
      yield;
      options.work.units++;
      route.loopStepSizePx = Math.min(180, route.loopStepSizePx + 4);
    }
    for (const { edge: other, index: otherIndex } of preparation.fixed) {
      yield;
      options.work.units++;
      if (!edgeHasVisibleLabel(edge) || !edgeHasVisibleLabel(other)) continue;
      const fixed = layout.get(other.id)!;
      while (
        labelOverlap(
          loopLabelPoint(source, route),
          size,
          loopLabelPoint(source, fixed),
          preparation.size(other, otherIndex),
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
  preparation: LoopPreparation,
): Generator<void, number> {
  const points: { x: number; y: number }[] = [];
  const routes = edges.map((edge) => layout.get(edge.id)!);
  const bundles = new Map<string, number>();
  let score = 0;
  for (const [edgeIndex, edge] of edges.entries()) {
    yield;
    const route = routes[edgeIndex]!;
    const manual =
      edge.routing?.loopDirectionDeg !== undefined ||
      edge.routing?.loopSweepDeg !== undefined;
    const key = `${route.loopDirectionDeg}:${route.loopSweepDeg}`;
    const bundle = bundles.get(key) ?? 0;
    bundles.set(key, bundle + 1);
    const point = loopLabelPoint(source, route, bundle);
    points.push(point);
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
        labelTouchesSource(source, point, preparation.size(edge, edgeIndex))
      )
        collisions++;
      if (nodes.length > 0) {
        const samples = nativeLoopSamplePoints(
          source,
          route,
          preparation.extent,
        );
        let rustScores: Float64Array | null = null;
        for (const [index, node] of nodes.entries()) {
          yield;
          if (index === 0)
            rustScores = scoreRustLoopObstacles(
              nodes,
              samples,
              30,
              { x1: -Infinity, y1: -Infinity, x2: Infinity, y2: Infinity },
              true,
            );
          if (rustScores) {
            const resultIndex = index * 3;
            options.work.units += rustScores[resultIndex + 1]!;
            collisions += rustScores[resultIndex + 2]!;
            continue;
          }
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
    }
    route.status = collisions ? "unresolved" : "ready";
    score += collisions * 1_000_000;
  }
  if (edges.length * edges.length > 4_000_000) return score;
  // Tiny groups have little pair work to amortize the extra scheduling setup.
  if (options.work.stableLabels && edges.length >= 8)
    return yield* scoreStableLoopLabelPairs(
      edges,
      points,
      routes,
      options,
      preparation,
      score,
    );

  // Public helpers can change labels while suspended. Keep their original
  // per-pair reads and yields unless the caller promises immutable labels.
  for (let i = 0; i < edges.length; i++)
    for (let j = 0; j < i; j++) {
      yield;
      options.work.units++;
      const a = edges[i]!,
        b = edges[j]!;
      if (!edgeHasVisibleLabel(a) || !edgeHasVisibleLabel(b)) continue;
      const overlap = labelOverlap(
        points[i]!,
        preparation.sizes[i] ?? preparation.size(a, i),
        points[j]!,
        preparation.sizes[j] ?? preparation.size(b, j),
      );
      if (overlap) {
        score += 10_000 + overlap;
        if (
          a.routing?.loopDirectionDeg === undefined &&
          a.routing?.loopSweepDeg === undefined
        )
          routes[i]!.status = "unresolved";
        if (
          b.routing?.loopDirectionDeg === undefined &&
          b.routing?.loopSweepDeg === undefined
        )
          routes[j]!.status = "unresolved";
      }
    }
  return score;
}

/** Skip invisible pairs while retaining their original work-budget charge. */
function* scoreStableLoopLabelPairs(
  edges: GraphEdge[],
  points: { x: number; y: number }[],
  routes: LoopPlacement[],
  options: ResolvedEdgeRoutingOptions,
  preparation: LoopPreparation,
  score: number,
): Generator<void, number> {
  yield;
  const visible: number[] = [];
  for (let index = 0; index < edges.length; index++)
    if (edgeHasVisibleLabel(edges[index]!)) visible.push(index);

  // Real comparisons yield every 64 pairs. Arithmetic-only skipped work is
  // charged in at-most-4096-unit chunks, below the synchronous 25000-unit
  // routing budget; cancellation never waits for an entire dense group.
  let unitsSinceYield = 0,
    pairsSinceYield = 0,
    accounted = 0;
  for (let right = 0; right < visible.length; right++) {
    const i = visible[right]!;
    for (let left = 0; left < right; left++) {
      const j = visible[left]!;
      const ordinal = (i * (i - 1)) / 2 + j;
      let skipped = ordinal - accounted;
      while (skipped > 0) {
        if (unitsSinceYield === 4096) {
          yield;
          unitsSinceYield = pairsSinceYield = 0;
        }
        const charge = Math.min(skipped, 4096 - unitsSinceYield);
        options.work.units += charge;
        unitsSinceYield += charge;
        skipped -= charge;
      }
      if (pairsSinceYield === 64 || unitsSinceYield === 4096) {
        yield;
        unitsSinceYield = pairsSinceYield = 0;
      }
      options.work.units++;
      unitsSinceYield++;
      pairsSinceYield++;
      accounted = ordinal + 1;
      const a = edges[i]!,
        b = edges[j]!;
      const overlap = labelOverlap(
        points[i]!,
        preparation.sizes[i] ?? preparation.size(a, i),
        points[j]!,
        preparation.sizes[j] ?? preparation.size(b, j),
      );
      if (overlap) {
        score += 10_000 + overlap;
        if (
          a.routing?.loopDirectionDeg === undefined &&
          a.routing?.loopSweepDeg === undefined
        )
          routes[i]!.status = "unresolved";
        if (
          b.routing?.loopDirectionDeg === undefined &&
          b.routing?.loopSweepDeg === undefined
        )
          routes[j]!.status = "unresolved";
      }
    }
  }
  let remaining = (edges.length * (edges.length - 1)) / 2 - accounted;
  while (remaining > 0) {
    if (unitsSinceYield === 4096) {
      yield;
      unitsSinceYield = 0;
    }
    const charge = Math.min(remaining, 4096 - unitsSinceYield);
    options.work.units += charge;
    unitsSinceYield += charge;
    remaining -= charge;
  }
  return score;
}
function nativeLoopSamplePoints(
  source: GraphNode,
  route: LoopPlacement,
  extent: LoopPreparation["extent"],
) {
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
    extent(nodeGeometryWidth(source) / 2, angle - sweep),
  );
  const end = ray(
    angle + sweep,
    extent(nodeGeometryWidth(source) / 2, angle + sweep),
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
