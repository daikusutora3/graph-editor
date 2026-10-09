import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import { computeEdgeRouting } from "../../features/graph-editor/core/layout/edge-routing";
import { sampleEdgeCurve } from "../../features/graph-editor/core/layout/edge-route-geometry";
import {
  getModelBounds,
  createPreviewEdgePath,
  SampleGraphPreview,
} from "../../features/graph-editor/ui/samples/SampleGraphPreview";
import { previewCurveBounds } from "../../features/graph-editor/ui/samples/preview-curve-bounds";

const quadratic = previewCurveBounds([
  { x: 0, y: 0 },
  { x: -100, y: 180 },
  { x: 100, y: 0 },
]);
near(quadratic.minX, -100 / 3);
near(quadratic.maxX, 100);
near(quadratic.minY, 0);
near(quadratic.maxY, 90);

const cubic = previewCurveBounds([
  { x: 0, y: 0 },
  { x: 100, y: 180 },
  { x: -100, y: -180 },
  { x: 0, y: 0 },
]);
near(cubic.minX, -100 / (2 * Math.sqrt(3)));
near(cubic.maxX, 100 / (2 * Math.sqrt(3)));
near(cubic.minY, -180 / (2 * Math.sqrt(3)));
near(cubic.maxY, 180 / (2 * Math.sqrt(3)));

const degenerateCubic = previewCurveBounds([
  { x: 0, y: 0 },
  { x: 20, y: 40 },
  { x: 40, y: 40 },
  { x: 60, y: 0 },
]);
near(degenerateCubic.minX, 0);
near(degenerateCubic.maxX, 60);
near(degenerateCubic.maxY, 30);
assert.deepEqual(
  previewCurveBounds([
    { x: 2, y: -3 },
    { x: 2, y: -3 },
    { x: 2, y: -3 },
  ]),
  { minX: 2, maxX: 2, minY: -3, maxY: -3 },
);

const bowedModel = createModel();
const bounds = getModelBounds(
  bowedModel,
  computeEdgeRouting(bowedModel, { mode: "simple" }),
  true,
);
near(bounds.minX, -24);
near(bounds.width, 148);
near(bounds.minY, -24);
near(bounds.height, 114);

const multiRoutes = computeEdgeRouting(bowedModel, { mode: "simple" });
const multiCurve = {
  controlPointDistancesPx: [120, -200, 180],
  controlPointWeights: [0.2, 0.5, 0.8],
};
multiRoutes.set("edge", { ...multiRoutes.get("edge")!, ...multiCurve });
const multiBounds = getModelBounds(bowedModel, multiRoutes, true);
for (const point of sampleEdgeCurve(
  bowedModel.nodes[0],
  bowedModel.nodes[1],
  multiCurve,
  200,
)) {
  assert(
    point.x >= multiBounds.minX - 1e-8 &&
      point.x <= multiBounds.minX + multiBounds.width + 1e-8,
  );
  assert(
    point.y >= multiBounds.minY - 1e-8 &&
      point.y <= multiBounds.minY + multiBounds.height + 1e-8,
  );
}
assert(
  multiBounds.minY < -24 && multiBounds.minY + multiBounds.height > 24,
  "chained quadratic bounds include bends on both sides of the chord",
);

// Sample the rendered SVG rather than mirroring the bounds helper. These cases
// exercise the actual fit scale, shortened arrow endpoints and shared C loops.
for (const directed of [false, true]) {
  for (const variant of ["editor", "sample"] as const) {
    for (const bowPx of [-180, 0, 180]) {
      for (const [targetX, targetY] of [
        [100, 0],
        [0, 100],
        [100, 80],
        [20, 0],
        [0.1, 0],
        [0.5, 0],
        [1, 0],
      ]) {
        const model = createModel(directed, targetX, targetY, bowPx);
        for (const focus of [false, true])
          verifyRenderedFit(model, variant, focus);
      }
    }
    for (const loopDirectionDeg of [-90, 0, 45, 120, 180]) {
      const model = {
        ...createEmptyGraphModel({ directed }),
        nodes: [{ id: "a", order: 0, label: "long label 日本語", x: 0, y: 0 }],
        edges: [
          {
            id: "loop",
            source: "a",
            target: "a",
            routing: { loopDirectionDeg, loopSweepDeg: 110 },
          },
        ],
      };
      verifyRenderedFit(model, variant);
    }
  }
}
verifyRenderedFit(createModel(true, 50, 0, 180), "editor", true);
verifyRenderedFit(
  {
    ...createEmptyGraphModel(),
    nodes: [{ id: "a", order: 0, label: "long label 日本語", x: 80, y: -120 }],
  },
  "editor",
);
assert.deepEqual(getModelBounds(createEmptyGraphModel(), new Map(), true), {
  minX: -1,
  minY: -1,
  width: 2,
  height: 2,
});

for (const targetX of [0.1, 0.5, 1]) {
  const original = createPreviewEdgePath({
    directed: true,
    radius: 24,
    scale: 1,
    source: { x: 0, y: 0 },
    target: { x: targetX, y: 0 },
  })
    .match(/-?\d+(?:\.\d+)?/g)!
    .map(Number);
  for (const scale of [0.2, 0.5, 2, 3]) {
    const scaled = createPreviewEdgePath({
      directed: true,
      radius: 24 * scale,
      scale,
      source: { x: 0, y: 0 },
      target: { x: targetX * scale, y: 0 },
    })
      .match(/-?\d+(?:\.\d+)?/g)!
      .map(Number);
    scaled.forEach((coordinate, index) => {
      assert(
        Math.abs(coordinate - original[index] * scale) < 0.016,
        "shortened arrow endpoints must scale with the rest of the path",
      );
    });
  }
}

console.log("Sample preview bounds verification passed");

function createModel(
  directed = false,
  targetX = 100,
  targetY = 0,
  bowPx = 180,
): GraphModel {
  return {
    ...createEmptyGraphModel({ directed }),
    nodes: [
      { id: "a", order: 0, label: "A", x: 0, y: 0 },
      { id: "b", order: 1, label: "B", x: targetX, y: targetY },
    ],
    edges: [
      { id: "edge", source: "a", target: "b", routing: { bowPx, bowT: 0.5 } },
    ],
  };
}

function verifyRenderedFit(
  model: GraphModel,
  variant: "sample" | "editor",
  focus = false,
) {
  const markup = renderToStaticMarkup(
    createElement(SampleGraphPreview, {
      model,
      width: 160,
      height: 150,
      variant,
      focus,
    }),
  );
  const paths = [...markup.matchAll(/<path\b[^>]*d="([^"]+)"[^>]*stroke="/g)];
  assert.equal(
    paths.length,
    model.edges.length,
    "every model edge is included in the SVG fit check",
  );
  for (const [, path] of paths) {
    const tokens = path.match(/[MQCL]|-?\d+(?:\.\d+)?/g)!;
    let start = { x: 0, y: 0 };
    for (let index = 0; index < tokens.length;) {
      const command = tokens[index++];
      if (command === "M") {
        start = { x: Number(tokens[index++]), y: Number(tokens[index++]) };
        continue;
      }
      const count = command === "C" ? 3 : command === "Q" ? 2 : 1;
      const points = [start];
      for (let control = 0; control < count; control++) {
        points.push({ x: Number(tokens[index++]), y: Number(tokens[index++]) });
      }
      for (let sample = 0; sample <= 200; sample++) {
        const t = sample / 200;
        const weights =
          count === 3
            ? [(1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t ** 2, t ** 3]
            : count === 2
              ? [(1 - t) ** 2, 2 * (1 - t) * t, t ** 2]
              : [1 - t, t];
        const x = points.reduce(
          (sum, point, pointIndex) => sum + point.x * weights[pointIndex],
          0,
        );
        const y = points.reduce(
          (sum, point, pointIndex) => sum + point.y * weights[pointIndex],
          0,
        );
        assert(
          x >= 1 && x <= 159 && y >= 1 && y <= 149,
          `${variant} curve leaves 160x150 preview at ${x},${y}: ${path}`,
        );
      }
      start = points.at(-1)!;
    }
  }
  for (const [rect] of markup.matchAll(/<rect\b[^>]+/g)) {
    const read = (attribute: string) =>
      Number(rect.match(new RegExp(`\\b${attribute}="([^"]+)"`))![1]);
    const x = read("x"),
      y = read("y");
    assert(
      x >= 1 && x + read("width") <= 159 && y >= 1 && y + read("height") <= 149,
      `editor pill leaves 160x150 preview: ${rect}`,
    );
  }
  for (const [circle] of markup.matchAll(/<circle\b[^>]+/g)) {
    const read = (attribute: string) =>
      Number(circle.match(new RegExp(`\\b${attribute}="([^"]+)"`))![1]);
    const x = read("cx"),
      y = read("cy"),
      radius = read("r");
    assert(
      x - radius >= 1 &&
        x + radius <= 159 &&
        y - radius >= 1 &&
        y + radius <= 149,
      `sample node leaves 160x150 preview: ${circle}`,
    );
  }
}

function near(actual: number, expected: number) {
  assert(
    Math.abs(actual - expected) < 1e-8,
    `expected ${expected}, got ${actual}`,
  );
}
