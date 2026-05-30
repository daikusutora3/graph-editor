import { createEmptyGraphModel } from "../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../features/graph-editor/core/graph/model";
import { createEdgeRoutingCacheKey } from "../features/graph-editor/core/layout/edge-routing";
import {
  createManualLayoutCommand,
  layoutDefinitions,
  manualLayoutDisabledReason,
} from "../features/graph-editor/layouts";

const failures: string[] = [];
const kinds = layoutDefinitions.map((definition) => definition.kind);
const kindSet = new Set(kinds);

if (kindSet.size !== kinds.length) {
  failures.push("layout registry contains duplicate kinds");
}

for (const definition of layoutDefinitions) {
  if (hasBlankLayoutText(definition)) {
    failures.push(`${definition.kind}: missing display metadata`);
  }

  manualLayoutDisabledReason(definition.kind, createEmptyGraphModel());
  createManualLayoutCommand(createEmptyGraphModel(), definition.kind);
}

const undirectedPath = graphFixture({
  directed: false,
  edges: [
    ["a", "b"],
    ["b", "c"],
  ],
});
const directedDag = graphFixture({
  directed: true,
  edges: [
    ["a", "b"],
    ["b", "c"],
  ],
});
const directedCycle = graphFixture({
  directed: true,
  edges: [
    ["a", "b"],
    ["b", "c"],
    ["c", "a"],
  ],
});
const triangle = graphFixture({
  directed: false,
  edges: [
    ["a", "b"],
    ["b", "c"],
    ["c", "a"],
  ],
});

expect(
  manualLayoutDisabledReason("tree", undirectedPath) === null,
  "tree layout should be enabled for forests",
);
expect(
  manualLayoutDisabledReason("tree", triangle) !== null,
  "tree layout should be disabled for cyclic graphs",
);
expect(
  manualLayoutDisabledReason("dagLayer", directedDag) === null,
  "DAG layout should be enabled for directed acyclic graphs",
);
expect(
  manualLayoutDisabledReason("dagLayer", directedCycle) !== null,
  "DAG layout should be disabled for directed cycles",
);
expect(
  manualLayoutDisabledReason("bipartite", triangle) !== null,
  "bipartite layout should be disabled for non-bipartite graphs",
);

const routingBase = graphFixture({
  directed: false,
  edges: [
    ["a", "b"],
    ["b", "c"],
  ],
});
const routingBaseKey = createEdgeRoutingCacheKey(routingBase, {
  avoidNodes: true,
});
expect(
  createEdgeRoutingCacheKey(
    {
      ...routingBase,
      nodes: routingBase.nodes.map((node) =>
        node.id === "a" ? { ...node, label: "renamed" } : node,
      ),
    },
    { avoidNodes: true },
  ) === routingBaseKey,
  "routing cache key should ignore node labels",
);
expect(
  createEdgeRoutingCacheKey(
    {
      ...routingBase,
      nodes: routingBase.nodes.map((node) =>
        node.id === "a" ? { ...node, x: node.x + 10 } : node,
      ),
    },
    { avoidNodes: true },
  ) !== routingBaseKey,
  "routing cache key should include node positions when node avoidance is enabled",
);
expect(
  createEdgeRoutingCacheKey(
    {
      ...routingBase,
      edges: routingBase.edges.map((edge) =>
        edge.id === "e0" ? { ...edge, routing: { bowPx: 20 } } : edge,
      ),
    },
    { avoidNodes: true },
  ) !== routingBaseKey,
  "routing cache key should include edge routing overrides",
);

if (failures.length > 0) {
  console.error(`Layout verification failed (${failures.length})`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Layout verification passed (${layoutDefinitions.length} kinds)`);

function expect(condition: boolean, message: string) {
  if (!condition) {
    failures.push(message);
  }
}

function hasBlankLayoutText(definition: {
  label: string;
  subtitle: string;
  tooltip: string;
}) {
  return [definition.label, definition.subtitle, definition.tooltip].some(
    (value) => value.trim() === "",
  );
}

function graphFixture({
  directed,
  edges,
}: {
  directed: boolean;
  edges: Array<readonly [string, string]>;
}): GraphModel {
  const ids = [...new Set(edges.flat())];

  return {
    ...createEmptyGraphModel({ directed }),
    nodes: ids.map((id, index) => ({
      id,
      label: id,
      order: index,
      x: index * 120,
      y: 0,
    })),
    edges: edges.map(([source, target], index) => ({
      id: `e${index}`,
      source,
      target,
    })),
  };
}
