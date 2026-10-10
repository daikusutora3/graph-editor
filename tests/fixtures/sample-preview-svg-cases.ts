import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";

/** Representative preview settings, loops, dangling edges and chunk boundaries. */
export function samplePreviewSvgCases() {
  const cases: Array<{
    name: string;
    model: GraphModel;
    variant: "sample" | "editor";
    width: number;
    height: number;
    focus: boolean;
  }> = [];
  for (const directed of [false, true]) {
    for (const variant of ["sample", "editor"] as const) {
      for (const focus of [false, true]) {
        for (const showNodeLabels of [false, true]) {
          const model: GraphModel = {
            ...createEmptyGraphModel({
              directed,
              showNodeLabels,
              allowMultiEdges: true,
              allowSelfLoops: true,
              arrowScale: 1.6,
            }),
            nodes: [
              { id: "a", order: 0, label: "A", x: 0, y: 0, color: "yellow" },
              {
                id: "b",
                order: 1,
                label: "日本語 long label",
                x: 160,
                y: 0,
                color: "black",
              },
              { id: "c", order: 2, label: "C", x: 160, y: 120 },
            ],
            edges: [
              {
                id: "straight",
                source: "a",
                target: "b",
                color: "blue",
                routing: { bowPx: 0, bowT: 0.5 },
              },
              {
                id: "bowed",
                source: "b",
                target: "c",
                color: "red",
                routing: { bowPx: -80, bowT: 0.3 },
              },
              {
                id: "reverse",
                source: "b",
                target: "a",
                routing: { bowPx: 120, bowT: 0.7 },
              },
              {
                id: "loop",
                source: "c",
                target: "c",
                color: "green",
                routing: {
                  loopDirectionDeg: 45,
                  loopSweepDeg: 110,
                },
              },
              { id: "missing", source: "c", target: "missing" },
            ],
          };
          for (const [width, height] of [
            [98, 76],
            [320, 150],
          ])
            cases.push({
              name: `${directed}-${variant}-${focus}-${showNodeLabels}-${width}`,
              model,
              variant,
              focus,
              width,
              height,
            });
        }
      }
    }
  }
  const chunked: GraphModel = {
    ...createEmptyGraphModel({ directed: true }),
    nodes: Array.from({ length: 260 }, (_, index) => ({
      id: `n${index}`,
      order: index,
      label: String(index),
      x: index * 100,
      y: (index % 2) * 60,
    })),
    edges: Array.from({ length: 259 }, (_, index) => ({
      id: `e${index}`,
      source: `n${index}`,
      target: `n${index + 1}`,
      routing: { bowPx: 50, bowT: 0.5 },
    })),
  };
  for (const variant of ["sample", "editor"] as const)
    cases.push({
      name: `chunked-${variant}`,
      model: chunked,
      variant,
      focus: false,
      width: 160,
      height: 150,
    });
  cases.push({
    name: "empty",
    model: createEmptyGraphModel(),
    variant: "editor",
    focus: false,
    width: 160,
    height: 150,
  });
  return cases;
}
