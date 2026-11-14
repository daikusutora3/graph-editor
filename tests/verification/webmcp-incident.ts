import assert from "node:assert/strict";
import { createStore } from "jotai/vanilla";

import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import {
  graphAtom,
  syncExternalGraphAtom,
} from "../../features/graph-editor/shell/state/graph-atoms";
import { historyAtom } from "../../features/graph-editor/shell/state/history-atoms";
import {
  registerGraphWebMcp,
  type GraphModelContext,
} from "../../features/graph-editor/webmcp/graph-webmcp";

type Tool = Parameters<GraphModelContext["registerTool"]>[0];
type Item = {
  id: string;
  source: string;
  target: string;
  weight?: string;
  label?: string;
  color?: string;
  neighbor: { id: string; label: string };
};
type Result = {
  ok: boolean;
  code?: string;
  revision?: string;
  directed?: boolean;
  weighted?: boolean;
  direction?: string;
  matchCount?: number;
  offset?: number;
  nextOffset?: number | null;
  items?: Item[];
};

const registered = new Map<string, Tool>();
const context: GraphModelContext = {
  async registerTool(tool, { signal }) {
    registered.set(tool.name, tool);
    signal.addEventListener("abort", () => registered.delete(tool.name), {
      once: true,
    });
  },
};
const store = createStore();
const dispose = registerGraphWebMcp(context, store, () => {});
await Promise.resolve();
const incident = registered.get("get_incident_edges");
assert(incident, "incident-edge search must be registered");
assert.equal(incident.annotations.readOnlyHint, true);
assert.equal(incident.annotations.untrustedContentHint, true);
const call = async (input: unknown): Promise<Result> =>
  (await incident.execute(input)) as Result;

const graph: GraphModel = {
  ...createEmptyGraphModel({ directed: true, weighted: true }),
  nodes: [
    { id: "a", label: "A", order: 0, x: 1, y: 2 },
    { id: "b", label: "B", order: 1, x: 3, y: 4 },
    { id: "c", label: "C", order: 2, x: 5, y: 6 },
    { id: "d", label: "D", order: 3, x: 7, y: 8 },
  ],
  edges: [
    { id: "loop", source: "a", target: "a", weight: "5" },
    { id: "out1", source: "a", target: "b", weight: "1", color: "red" },
    { id: "in1", source: "b", target: "a", weight: "2", label: "back" },
    { id: "out2", source: "a", target: "b", weight: "3" },
    { id: "in2", source: "c", target: "a", weight: "4" },
    { id: "other", source: "b", target: "c", weight: "6" },
  ],
};
store.set(syncExternalGraphAtom, structuredClone(graph));
const before = structuredClone(store.get(graphAtom));
const historyBefore = store.get(historyAtom);

const all = await call({ node: { label: "A" } });
assert.equal(all.ok, true);
assert.equal(all.matchCount, 5);
assert.equal(all.directed, true);
assert.equal(all.weighted, true);
assert.equal(all.direction, "all");
assert.equal(all.offset, 0);
assert.equal(all.nextOffset, null);
assert.deepEqual(all.items, [
  {
    id: "loop",
    source: "a",
    target: "a",
    weight: "5",
    neighbor: { id: "a", label: "A" },
  },
  {
    id: "out1",
    source: "a",
    target: "b",
    weight: "1",
    color: "red",
    neighbor: { id: "b", label: "B" },
  },
  {
    id: "in1",
    source: "b",
    target: "a",
    weight: "2",
    label: "back",
    neighbor: { id: "b", label: "B" },
  },
  {
    id: "out2",
    source: "a",
    target: "b",
    weight: "3",
    neighbor: { id: "b", label: "B" },
  },
  {
    id: "in2",
    source: "c",
    target: "a",
    weight: "4",
    neighbor: { id: "c", label: "C" },
  },
]);
assert.equal(typeof all.revision, "string");
assert(JSON.stringify(all).length <= 12_000);

const outgoing = await call({ node: { id: "a" }, direction: "out" });
assert.equal(outgoing.direction, "out");
assert.equal(outgoing.matchCount, 3);
assert.deepEqual(
  outgoing.items?.map(({ id }) => id),
  ["loop", "out1", "out2"],
);
const incoming = await call({ node: { id: "a" }, direction: "in" });
assert.equal(incoming.direction, "in");
assert.equal(incoming.matchCount, 3);
assert.deepEqual(
  incoming.items?.map(({ id }) => id),
  ["loop", "in1", "in2"],
);
const isolated = await call({ node: { label: "D" } });
assert.equal(isolated.matchCount, 0);
assert.deepEqual(isolated.items, []);
assert.equal(isolated.nextOffset, null);

const firstPage = await call({
  node: { id: "a" },
  offset: 0,
  limit: 2,
  expectedRevision: all.revision,
});
assert.equal(firstPage.matchCount, 5);
assert.deepEqual(
  firstPage.items?.map(({ id }) => id),
  ["loop", "out1"],
);
assert.equal(firstPage.nextOffset, 2);
const nextPage = await call({
  node: { id: "a" },
  offset: firstPage.nextOffset,
  limit: 2,
  expectedRevision: all.revision,
});
assert.deepEqual(
  nextPage.items?.map(({ id }) => id),
  ["in1", "out2"],
);
assert.equal(nextPage.nextOffset, 4);
const lastPage = await call({
  node: { id: "a" },
  offset: nextPage.nextOffset,
  limit: 2,
  expectedRevision: all.revision,
});
assert.deepEqual(
  lastPage.items?.map(({ id }) => id),
  ["in2"],
);
assert.equal(lastPage.nextOffset, null);
const beyond = await call({ node: { id: "a" }, offset: 100 });
assert.deepEqual(beyond.items, []);
assert.equal(beyond.nextOffset, null);

const invalidInputs = [
  {},
  { node: { id: "a", label: "A" } },
  { node: { id: "a" }, direction: "both" },
  { node: { id: "a" }, offset: -1 },
  { node: { id: "a" }, offset: Number.MAX_SAFE_INTEGER + 1 },
  { node: { id: "a" }, limit: 0 },
  { node: { id: "a" }, limit: 11 },
  { node: { id: "a" }, extra: true },
];
const invalidResults = await Promise.all(invalidInputs.map(call));
for (const result of invalidResults) assert.equal(result.code, "invalid-input");
assert.equal((await call({ node: { id: "missing" } })).code, "node-not-found");
assert.deepEqual(
  store.get(graphAtom),
  before,
  "reads and errors preserve the graph",
);
assert.equal(
  store.get(historyAtom),
  historyBefore,
  "reads do not change history",
);

const undirected: GraphModel = {
  ...graph,
  settings: { ...graph.settings, directed: false },
};
store.set(syncExternalGraphAtom, structuredClone(undirected));
assert.equal(
  (await call({ node: { id: "a" }, expectedRevision: all.revision })).code,
  "stale-revision",
);
const undirectedResults = await Promise.all(
  ["all", "in", "out"].map((direction) =>
    call({ node: { id: "a" }, direction }),
  ),
);
for (const result of undirectedResults) {
  assert.equal(result.directed, false);
  assert.equal(result.matchCount, 5);
  assert.deepEqual(
    result.items?.map(({ id }) => id),
    ["loop", "out1", "in1", "out2", "in2"],
  );
}
const duplicate: GraphModel = {
  ...undirected,
  nodes: undirected.nodes.map((node) =>
    node.id === "b" ? { ...node, label: "A" } : node,
  ),
};
store.set(syncExternalGraphAtom, duplicate);
assert.equal((await call({ node: { label: "A" } })).code, "ambiguous-node");
assert.equal((await call({ node: { id: "a" } })).matchCount, 5);

// Valid imported IDs can exceed the per-response budget. A page ends before
// such an item; an oversized item is never returned or silently truncated.
const hugeId = `large-${"x".repeat(20_000)}`;
const withHugeId: GraphModel = {
  ...createEmptyGraphModel(),
  nodes: [
    { id: "a", label: "A", order: 0, x: 0, y: 0 },
    { id: "b", label: "B", order: 1, x: 1, y: 0 },
    { id: hugeId, label: "Large", order: 2, x: 2, y: 0 },
  ],
  edges: [
    { id: "small", source: "a", target: "b" },
    { id: "huge", source: "a", target: hugeId },
    { id: "last", source: "a", target: "b" },
  ],
};
store.set(syncExternalGraphAtom, withHugeId);
const bounded = await call({ node: { id: "a" }, limit: 3 });
assert.equal(bounded.ok, true);
assert.deepEqual(
  bounded.items?.map(({ id }) => id),
  ["small"],
);
assert.equal(bounded.matchCount, 3);
assert.equal(bounded.nextOffset, 1);
assert(JSON.stringify(bounded).length <= 12_000);
const tooLarge = await call({ node: { id: "a" }, offset: 1 });
assert.equal(tooLarge.code, "element-too-large");
assert.equal(tooLarge.items, undefined);
assert(JSON.stringify(tooLarge).length <= 12_000);
assert(!JSON.stringify(tooLarge).includes(hugeId));
assert.deepEqual(store.get(graphAtom), withHugeId);

const fullCapacity: GraphModel = {
  ...createEmptyGraphModel(),
  nodes: graph.nodes.slice(0, 2),
  edges: Array.from({ length: 5_000 }, (_, index) => ({
    id: `edge-${index}`,
    source: "a",
    target: "b",
  })),
};
store.set(syncExternalGraphAtom, fullCapacity);
const capacityPage = await call({
  node: { label: "A" },
  offset: 4_990,
  limit: 10,
});
assert.equal(capacityPage.ok, true);
assert.equal(capacityPage.matchCount, 5_000);
assert.equal(capacityPage.items?.length, 10);
assert.equal(capacityPage.items?.[0]?.id, "edge-4990");
assert.equal(capacityPage.nextOffset, null);
assert(JSON.stringify(capacityPage).length <= 12_000);
assert.deepEqual(store.get(graphAtom), fullCapacity);

dispose();
assert(!registered.has("get_incident_edges"));
assert.equal((await call({ node: { label: "A" } })).code, "cancelled");
console.log("WebMCP incident-edge verification passed");
