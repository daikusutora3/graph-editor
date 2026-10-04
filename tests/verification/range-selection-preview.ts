import assert from "node:assert/strict";
import type { Core, EdgeSingular } from "cytoscape";

import {
  edgeControlPathInBox,
  readRangeSelectionPreview,
  type RangeSelectionBox,
  type RangeSelectionViewport,
} from "../../features/graph-editor/canvas/range-selection-preview-geometry";
import {
  edgeControlPathInBoxReference,
  readRangeSelectionPreviewReference,
} from "../fixtures/range-selection-preview-reference";

const smallBox = { x1: 0, y1: 0, x2: 100, y2: 100 };
const boxes: RangeSelectionBox[] = [
  smallBox,
  { x1: -1000, y1: -1000, x2: 1000, y2: 1000 },
  { x1: 50, y1: 50, x2: 50, y2: 50 },
  { x1: -10, y1: -10, x2: 0, y2: 0 },
];
const point = (x: number, y: number) => ({ x, y });
const examples = [
  { name: "straight", source: point(10, 10), target: point(90, 90) },
  { name: "source outside", source: point(-1, 0), target: point(90, 90) },
  { name: "target outside", source: point(10, 10), target: point(101, 90) },
  { name: "boundary", source: point(0, 0), target: point(100, 100) },
  {
    name: "curve outside",
    source: point(10, 10),
    target: point(90, 10),
    controls: [point(50, -20)],
  },
  {
    name: "loop inside",
    source: point(50, 50),
    target: point(50, 50),
    controls: [point(0, 0), point(100, 100)],
  },
  {
    name: "loop outside",
    source: point(50, 50),
    target: point(50, 50),
    controls: [point(0, 0), point(101, 100)],
  },
  {
    name: "segments outside",
    source: point(10, 10),
    target: point(90, 90),
    segments: [point(110, 50)],
  },
  {
    name: "invalid points ignored",
    source: point(NaN, 0),
    target: point(50, 50),
    controls: [point(Infinity, 1), null, point(25, 25)],
    segments: [undefined, { x: "10", y: 10 }],
  },
  {
    name: "no finite points",
    source: undefined,
    target: point(NaN, Infinity),
    controls: [null, point(-Infinity, 0)],
    segments: [undefined],
  },
  {
    name: "geometry getters unavailable",
    source: point(50, 50),
    target: point(60, 60),
    throwControls: true,
    throwSegments: true,
  },
  {
    name: "numeric coordinate coercion",
    source: point(50, 50),
    target: point(60, 60),
    controls: [{ x: "101", y: "50" }],
  },
  {
    name: "null invalidates whole getter",
    source: point(50, 50),
    target: point(60, 60),
    controls: [point(101, 50), null],
  },
  {
    name: "overflow after zoom",
    source: point(50, 50),
    target: point(60, 60),
    controls: [point(Number.MAX_VALUE, 50)],
  },
  {
    name: "sparse geometry",
    source: point(50, 50),
    target: point(60, 60),
    controls: Array.from({ length: 3 }, (_, index) => point(index * 25, 50)),
  },
];
delete examples.at(-1)!.controls![1];
type Example = {
  name: string;
  source: unknown;
  target: unknown;
  controls?: unknown[];
  segments?: unknown[];
  throwControls?: boolean;
  throwSegments?: boolean;
};
type Calls = {
  source: number;
  target: number;
  controls: number;
  segments: number;
};
function fakeEdge(
  example: Example,
  calls?: Calls,
  viewport: RangeSelectionViewport = { zoom: 1, pan: { x: 0, y: 0 } },
) {
  const controls = () => {
    if (calls) calls.controls++;
    if (example.throwControls) throw new Error("unavailable geometry");
    return example.controls;
  };
  const segments = () => {
    if (calls) calls.segments++;
    if (example.throwSegments) throw new Error("unavailable geometry");
    return example.segments;
  };
  // Match the installed Cytoscape rendered plural getter, including its
  // coercion, undefined-array throws, sparse map and malformed-point throws.
  const render = (points: unknown[] | undefined) =>
    points!.map((value) => {
      const valuePoint = value as { x: number; y: number };
      return {
        x: valuePoint.x * viewport.zoom + viewport.pan.x,
        y: valuePoint.y * viewport.zoom + viewport.pan.y,
      };
    });
  return {
    id: () => example.name,
    renderedSourceEndpoint: () => {
      if (calls) calls.source++;
      return example.source;
    },
    renderedTargetEndpoint: () => {
      if (calls) calls.target++;
      return example.target;
    },
    controlPoints: controls,
    segmentPoints: segments,
    renderedControlPoints: () => render(controls()),
    renderedSegmentPoints: () => render(segments()),
  } as unknown as EdgeSingular;
}

for (const box of boxes)
  for (const example of examples)
    assert.equal(
      edgeControlPathInBox(box, fakeEdge(example)),
      edgeControlPathInBoxReference(box, fakeEdge(example)),
      `${example.name} must preserve containment in ${JSON.stringify(box)}`,
    );
for (const viewport of [
  { zoom: 0.1, pan: { x: 100, y: -50 } },
  { zoom: 1.5, pan: { x: -100, y: 50 } },
  { zoom: 2, pan: { x: 0, y: 0 } },
])
  for (const box of boxes)
    for (const example of examples)
      assert.equal(
        edgeControlPathInBox(
          box,
          fakeEdge(example, undefined, viewport),
          viewport,
        ),
        edgeControlPathInBoxReference(
          box,
          fakeEdge(example, undefined, viewport),
        ),
        `${example.name} must retain mapped containment at ${JSON.stringify(viewport)}`,
      );
assert.equal(edgeControlPathInBox(smallBox, fakeEdge(examples[9])), true);

// Independent deterministic fixtures include both control/segment paths and
// invalid points. Compare with the saved, allocation-heavy implementation.
let seed = 0x12345678;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
};
for (let index = 0; index < 500; index++) {
  const nextPoint = () => point(random() * 300 - 100, random() * 300 - 100);
  const example = {
    name: `generated-${index}`,
    source: nextPoint(),
    target: index % 7 ? nextPoint() : point(NaN, 0),
    controls: [nextPoint(), nextPoint()],
    segments: index % 3 ? [] : [nextPoint(), null],
  };
  for (const box of boxes)
    assert.equal(
      edgeControlPathInBox(box, fakeEdge(example)),
      edgeControlPathInBoxReference(box, fakeEdge(example)),
    );
}

const calls = (): Calls => ({ source: 0, target: 0, controls: 0, segments: 0 });
const sourceOutside = calls();
edgeControlPathInBox(smallBox, fakeEdge(examples[1], sourceOutside));
assert.deepEqual(sourceOutside, {
  source: 1,
  target: 0,
  controls: 0,
  segments: 0,
});
const targetOutside = calls();
edgeControlPathInBox(smallBox, fakeEdge(examples[2], targetOutside));
assert.deepEqual(targetOutside, {
  source: 1,
  target: 1,
  controls: 0,
  segments: 0,
});
const controlOutside = calls();
edgeControlPathInBox(smallBox, fakeEdge(examples[4], controlOutside));
assert.deepEqual(controlOutside, {
  source: 1,
  target: 1,
  controls: 1,
  segments: 0,
});
const enclosing = calls();
edgeControlPathInBox(boxes[1], fakeEdge(examples[4], enclosing));
assert.deepEqual(enclosing, { source: 1, target: 1, controls: 1, segments: 1 });

const liveExample: Example = {
  name: "live geometry",
  source: point(10, 10),
  target: point(90, 90),
  controls: [point(50, 50)],
};
const liveEdge = fakeEdge(liveExample);
assert.equal(edgeControlPathInBox(smallBox, liveEdge), true);
liveExample.source = point(-1, 10);
assert.equal(edgeControlPathInBox(smallBox, liveEdge), false);
liveExample.source = point(10, 10);
liveExample.controls = [point(50, 101)];
assert.equal(edgeControlPathInBox(smallBox, liveEdge), false);
liveExample.controls = [point(50, 50)];
assert.equal(edgeControlPathInBox(smallBox, liveEdge), true);

const nodes = [
  { id: "inside", box: { x1: 10, y1: 10, x2: 50, y2: 50 } },
  { id: "boundary", box: smallBox },
  { id: "overlapping", box: { x1: 90, y1: 90, x2: 110, y2: 110 } },
  { id: "outside", box: { x1: 101, y1: 10, x2: 110, y2: 50 } },
  { id: "invalid", box: { x1: NaN, y1: 10, x2: 50, y2: 50 } },
];
for (const filter of ["all", "nodes", "edges"] as const) {
  let nodeReads = 0;
  let edgeReads = 0;
  const graph = {
    zoom: () => 1,
    pan: () => ({ x: 0, y: 0 }),
    nodes: () => {
      nodeReads++;
      return nodes.map((node) => ({
        id: () => node.id,
        renderedBoundingBox: (options: Record<string, boolean>) => {
          assert.deepEqual(options, {
            includeNodes: true,
            includeEdges: false,
            includeLabels: false,
            includeOverlays: false,
            includeUnderlays: false,
          });
          return node.box;
        },
      }));
    },
    edges: () => {
      edgeReads++;
      return examples.map((example) => fakeEdge(example));
    },
  } as unknown as Pick<Core, "nodes" | "edges" | "zoom" | "pan">;
  const actual = readRangeSelectionPreview(graph, smallBox, filter);
  assert.equal(nodeReads, filter === "edges" ? 0 : 1);
  assert.equal(edgeReads, filter === "nodes" ? 0 : 1);
  assert.deepEqual(
    actual,
    readRangeSelectionPreviewReference(graph, smallBox, filter),
  );
  assert.deepEqual(
    [...actual.nodeIds],
    filter === "edges" ? [] : ["inside", "boundary"],
  );
}

console.log("Range selection geometry equivalence and early rejection passed");
