import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import {
  nodeGeometryWidth,
  NODE_SIZE_PX,
} from "../../features/graph-editor/core/graph/node-size";
import {
  createOverlapTask,
  OVERLAP_GAP_PX,
  resolveNodeOverlaps,
  type OverlapResult,
} from "../../features/graph-editor/layouts/resolve-node-overlaps";
import { additionalOverlapCoordinateCases } from "../fixtures/overlap-coordinate-cases";
import {
  originalOverlapCoordinateGoldens,
  type OverlapCoordinateGolden,
} from "../fixtures/overlap-coordinate-goldens";
import { overlapVerificationFixtures } from "../fixtures/overlaps";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("Overlap");
// Far below the 1e-5px collision threshold; grid coordinates remain exact.
const COORDINATE_TOLERANCE_PX = 1e-7;

function coordinateGoldenError(
  actual: OverlapResult,
  golden: OverlapCoordinateGolden,
  snap: boolean,
): string | undefined {
  if (actual.status !== golden.status) return "status changed";
  if (actual.remainingPairs !== golden.remainingPairs)
    return "remaining collision count changed";
  if (
    JSON.stringify(Object.keys(actual.positions)) !==
    JSON.stringify(golden.positions.map(([id]) => id))
  )
    return "node IDs or ordering changed";
  for (const [id, x, y] of golden.positions) {
    const point = actual.positions[id]!;
    for (const [axis, expected] of [
      ["x", x],
      ["y", y],
    ] as const) {
      const difference = Math.abs(point[axis] - expected);
      if (
        !Number.isFinite(point[axis]) ||
        difference > (snap ? 0 : COORDINATE_TOLERANCE_PX)
      )
        return `${id}.${axis}: expected ${expected}, got ${point[axis]} (difference ${difference}px)`;
    }
  }
}

expect(
  Object.keys(originalOverlapCoordinateGoldens).length ===
    overlapVerificationFixtures.length,
  "every equivalence fixture has an original coordinate golden",
);

function verifyCoordinates(name: string, graph: GraphModel) {
  const input = JSON.stringify(graph);
  const result = resolveNodeOverlaps(graph);
  expect(
    JSON.stringify(Object.keys(result.positions)) ===
      JSON.stringify(
        graph.nodes
          .toSorted((a, b) => a.order - b.order || a.id.localeCompare(b.id))
          .map((node) => node.id),
      ),
    `${name}: node IDs retain the stable order`,
  );
  expect(JSON.stringify(graph) === input, `${name}: input is not mutated`);
  expect(result.remainingPairs === 0, `${name}: every collision is resolved`);

  const required = NODE_SIZE_PX + OVERLAP_GAP_PX;
  for (let first = 0; first < graph.nodes.length; first++) {
    const a = graph.nodes[first]!;
    const pointA = result.positions[a.id]!;
    expect(
      Number.isFinite(pointA.x) && Number.isFinite(pointA.y),
      `${name}/${a.id}: finite input produces finite coordinates`,
    );
    if (result.status === "unchanged")
      expect(
        pointA.x === a.x && pointA.y === a.y,
        `${name}/${a.id}: unchanged status preserves the original coordinates exactly`,
      );
    const spanA = Math.max(
      0,
      (nodeGeometryWidth({
        ...a,
        label: graph.settings.showNodeLabels ? a.label : "",
      }) -
        NODE_SIZE_PX) /
        2,
    );
    if (graph.settings.snapToGrid) {
      expect(
        pointA.x % 24 === 0 && pointA.y % 24 === 0,
        `${name}: resolved positions stay on the grid`,
      );
    }
    for (let second = first + 1; second < graph.nodes.length; second++) {
      const b = graph.nodes[second]!;
      const pointB = result.positions[b.id]!;
      const spanB = Math.max(
        0,
        (nodeGeometryWidth({
          ...b,
          label: graph.settings.showNodeLabels ? b.label : "",
        }) -
          NODE_SIZE_PX) /
          2,
      );
      expect(
        Math.hypot(
          Math.max(0, Math.abs(pointB.x - pointA.x) - spanA - spanB),
          pointB.y - pointA.y,
        ) >=
          required - 0.00001,
        `${name}: pill boundaries have the required clearance`,
      );
    }
  }
  const again = resolveNodeOverlaps({
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      ...result.positions[node.id],
    })),
  });
  expect(
    again.status === "unchanged" &&
      JSON.stringify(again.positions) === JSON.stringify(result.positions),
    `${name}: resolving twice does not move nodes again`,
  );

  const task = createOverlapTask(graph);
  let step = task.next();
  while (!step.done) step = task.next();
  expect(
    JSON.stringify(step.value) === JSON.stringify(result),
    `${name}: resumable and synchronous calculations agree`,
  );
  return result;
}

const nativeHypot = Math.hypot;
function scaledHypot(...values: number[]) {
  // Exercise a different valid rounding path without depending on the host's
  // libm or replacing the production implementation. Avoid overflow/underflow.
  if (values.some((value) => !Number.isFinite(value)))
    return nativeHypot(...values);
  const maximum = Math.max(0, ...values.map(Math.abs));
  return maximum === 0
    ? 0
    : maximum *
        Math.sqrt(
          values.reduce((sum, value) => sum + (value / maximum) ** 2, 0),
        );
}

try {
  const nativeAdditionalResults = new Map<string, OverlapResult>();
  for (const [mode, hypot] of [
    ["native hypot", nativeHypot],
    ["scaled hypot", scaledHypot],
  ] as const) {
    Math.hypot = hypot;
    for (const [name, graph] of overlapVerificationFixtures) {
      const result = verifyCoordinates(`${mode}/${name}`, graph);
      const golden = originalOverlapCoordinateGoldens[name];
      expect(Boolean(golden), `${name}: an original coordinate golden exists`);
      if (!golden) continue;
      const error = coordinateGoldenError(
        result,
        golden,
        graph.settings.snapToGrid,
      );
      expect(
        !error,
        `${mode}/${name}: original coordinates preserved; ${error}`,
      );
    }

    const results = new Map<string, OverlapResult>();
    for (const [name, graph, status] of additionalOverlapCoordinateCases) {
      const result = verifyCoordinates(`${mode}/${name}`, graph);
      expect(result.status === status, `${mode}/${name}: status is ${status}`);
      if (hypot === nativeHypot) nativeAdditionalResults.set(name, result);
      else {
        const native = nativeAdditionalResults.get(name)!;
        const error = coordinateGoldenError(
          result,
          {
            status: native.status,
            remainingPairs: native.remainingPairs,
            positions: Object.entries(native.positions).map(([id, point]) => [
              id,
              point.x,
              point.y,
            ]),
          },
          graph.settings.snapToGrid,
        );
        expect(
          !error,
          `${name}: alternative rounding remains stable; ${error}`,
        );
      }
      results.set(name, result);
      if (name.endsWith(" shuffled"))
        expect(
          JSON.stringify(result) ===
            JSON.stringify(results.get(name.replace(/ shuffled$/, ""))),
          `${mode}/${name}: input ordering does not change the result`,
        );
    }
  }
} finally {
  Math.hypot = nativeHypot;
}

// Verify that allowing last-bit rounding does not hide observable regressions.
const mutationFixture = overlapVerificationFixtures.find(
  ([name]) => name === "wide labels",
)!;
const mutationGolden = originalOverlapCoordinateGoldens[mutationFixture[0]]!;
const original = resolveNodeOverlaps(mutationFixture[1]);
function displaceFirstNode(amount: number): OverlapResult {
  const id = Object.keys(original.positions)[0]!;
  const point = original.positions[id]!;
  return {
    ...original,
    positions: {
      ...original.positions,
      [id]: { ...point, x: point.x + amount },
    },
  };
}
expect(
  !coordinateGoldenError(displaceFirstNode(1e-9), mutationGolden, false),
  "Coordinate comparison accepts host rounding far below the collision threshold",
);
for (const [name, mutation] of [
  ["coordinate displacement", displaceFirstNode(1e-4)],
  ["non-finite coordinate", displaceFirstNode(NaN)],
  ["status", { ...original, status: "unchanged" }],
  ["collision count", { ...original, remainingPairs: 1 }],
  [
    "node ordering",
    {
      ...original,
      positions: Object.fromEntries(
        Object.entries(original.positions).reverse(),
      ),
    },
  ],
] as const)
  expect(
    Boolean(coordinateGoldenError(mutation, mutationGolden, false)),
    `Coordinate comparison detects a ${name} regression`,
  );

const gridFixture = overlapVerificationFixtures.find(
  ([name]) => name === "coincident grid",
)!;
const gridOriginal = resolveNodeOverlaps(gridFixture[1]);
const gridId = Object.keys(gridOriginal.positions)[0]!;
expect(
  Boolean(
    coordinateGoldenError(
      {
        ...gridOriginal,
        positions: {
          ...gridOriginal.positions,
          [gridId]: {
            ...gridOriginal.positions[gridId]!,
            x: gridOriginal.positions[gridId]!.x + 1e-9,
          },
        },
      },
      originalOverlapCoordinateGoldens[gridFixture[0]]!,
      true,
    ),
  ),
  "Grid coordinates remain exact even for displacements below the non-grid tolerance",
);

finish(
  `Overlap verification passed (${overlapVerificationFixtures.length} original + ${additionalOverlapCoordinateCases.length} stability fixtures, native/scaled hypot)`,
);
