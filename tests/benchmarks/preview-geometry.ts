import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import { computeEdgeRouting } from "../../features/graph-editor/core/layout/edge-routing";
import * as previewGeometry from "../../features/graph-editor/ui/samples/preview-geometry";

// An older standalone bundle can be supplied for before/after comparisons.
// Routing is prepared outside the timed geometry and SVG path-string workload.
const moduleArgument = process.argv.find((argument) =>
  argument.startsWith("--geometry-module="),
);
const geometry: typeof previewGeometry = moduleArgument
  ? await import(pathToFileURL(moduleArgument.slice(18)).href)
  : previewGeometry;
const report = [];
for (const nodeCount of [20, 250, 1_000]) {
  for (const directed of [false, true]) {
    const model: GraphModel = {
      ...createEmptyGraphModel({
        directed,
        allowMultiEdges: true,
        allowSelfLoops: true,
        arrowScale: 1.5,
      }),
      nodes: Array.from({ length: nodeCount }, (_, index) => ({
        id: `n${index}`,
        order: index,
        label: index % 2 ? `${index} longer日本語` : String(index),
        x: Math.cos(index) * index * 10,
        y: Math.sin(index) * index * 10,
      })),
      // Includes self-loops, distinct parallel edges and both directions.
      edges: Array.from({ length: nodeCount * 5 }, (_, index) => ({
        id: `e${index}`,
        source: `n${index % nodeCount}`,
        target: `n${(index + Math.floor(index / nodeCount)) % nodeCount}`,
      })),
    };
    const routes = computeEdgeRouting(model, { mode: "simple" });
    for (const editorLike of [false, true]) {
      const run = () => {
        const prepared = geometry.preparePreviewGeometry(
          model,
          routes,
          editorLike,
          1.1,
        );
        const paths = [];
        for (const edge of model.edges) {
          const preparedEdge = prepared.edgeById.get(edge.id)!;
          paths.push(
            geometry.createPreparedPreviewEdgePath(preparedEdge, {
              directed,
              radius: 4,
              scale: 0.4,
              toPoint: (x, y) => ({ x: 30 + x * 0.4, y: 10 + y * 0.4 }),
              editorLike,
              targetWidth:
                prepared.nodeWidths.get(preparedEdge.target.id)! * 0.4,
            }),
          );
        }
        return {
          modelBounds: prepared.modelBounds,
          paintBounds: prepared.paintBounds,
          paths,
        };
      };
      const expected = run();
      const durations = [];
      for (let iteration = 0; iteration < 45; iteration++) {
        const start = performance.now();
        const result = run();
        const duration = performance.now() - start;
        assert.equal(result.paths.length, model.edges.length);
        if (iteration >= 10) durations.push(duration);
      }
      const actual = run();
      assert.deepEqual(actual, expected, "Repeated preview results are stable");
      report.push({
        nodes: nodeCount,
        edges: model.edges.length,
        directed,
        variant: editorLike ? "editor" : "gallery",
        medianMs: durations.sort((a, b) => a - b)[
          Math.floor(durations.length / 2)
        ],
        outputSha256: createHash("sha256")
          .update(JSON.stringify(actual))
          .digest("hex"),
      });
    }
  }
}
console.log(JSON.stringify({ warmups: 10, measurements: 35, report }, null, 2));
