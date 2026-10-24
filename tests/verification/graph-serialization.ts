import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  GraphContractError,
  normalizeGraphModel,
  serializeGraphModel,
} from "../../features/graph-editor/core/graph/graph-json";
import { GRAPH_MAX_JSON_CHARS } from "../../features/graph-editor/core/graph/graph-limits";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import { isGraphCoordinate } from "../../features/graph-editor/core/graph/graph-coordinates";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";

const referenceIndex = process.argv.indexOf("--reference-root");
const original =
  referenceIndex < 0
    ? undefined
    : ((await import(
        pathToFileURL(
          resolve(
            process.argv[referenceIndex + 1]!,
            "features/graph-editor/core/graph/graph-json.ts",
          ),
        ).href
      )) as {
        serializeGraphModel: typeof serializeGraphModel;
        normalizeGraphModel: typeof normalizeGraphModel;
      });

function reference(value: GraphModel) {
  const raw = JSON.stringify(value);
  const normalized = normalizeGraphModel(value);
  if (
    raw.length > GRAPH_MAX_JSON_CHARS ||
    !normalized ||
    !sameDocument(value, normalized)
  ) {
    const coordinate =
      Array.isArray(value.nodes) &&
      value.nodes.some(
        (node) =>
          node && (!isGraphCoordinate(node.x) || !isGraphCoordinate(node.y)),
      );
    throw new GraphContractError(
      coordinate ? "coordinate-range" : "invalid-graph",
    );
  }
  return raw;
}
function sameDocument(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b))
    return (
      a.length === b.length &&
      a.every((value, index) => sameDocument(value, b[index]))
    );
  if (!isRecord(a) || !isRecord(b)) return false;
  const keys = Object.keys(a).filter((key) => a[key] !== undefined);
  return (
    keys.length ===
      Object.keys(b).filter((key) => b[key] !== undefined).length &&
    keys.every((key) => sameDocument(a[key], b[key]))
  );
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function outcome(run: () => string) {
  try {
    return { text: run() };
  } catch (error) {
    return {
      error:
        error instanceof Error &&
        error.name === "GraphContractError" &&
        "reason" in error
          ? error.reason
          : (error as Error).name,
    };
  }
}
let cases = 0;
function verify(value: unknown, label: string) {
  const graph = value as GraphModel;
  assert.deepEqual(
    outcome(() => serializeGraphModel(graph)),
    outcome(() => reference(graph)),
    label,
  );
  if (original) {
    assert.deepEqual(
      outcome(() => serializeGraphModel(graph)),
      outcome(() => original.serializeGraphModel(graph)),
      `${label}: untouched original serializer`,
    );
    assert.deepEqual(
      outcome(() => JSON.stringify(normalizeGraphModel(graph))),
      outcome(() => JSON.stringify(original.normalizeGraphModel(graph))),
      `${label}: untouched original normalization`,
    );
  }
  cases += 1;
}
function fixture(): GraphModel {
  return {
    ...createEmptyGraphModel({
      directed: true,
      weighted: true,
      allowSelfLoops: true,
      allowMultiEdges: true,
    }),
    nodes: [
      { id: "a", label: "長🧭", order: 0, x: 10.25, y: -10 },
      { id: "b", label: "", order: 7, x: 80, y: 0, color: "blue" },
    ],
    edges: [
      {
        id: "ab",
        source: "a",
        target: "b",
        label: "線",
        weight: "3",
        color: "red",
        routing: { bowPx: 20, bowT: 0.3 },
      },
      {
        id: "aa",
        source: "a",
        target: "a",
        routing: { loopDirectionDeg: -30, loopSweepDeg: 100 },
      },
    ],
  };
}
const values: unknown[] = [
  undefined,
  null,
  true,
  false,
  0,
  -1,
  0.5,
  1,
  NaN,
  Infinity,
  "",
  " ",
  "valid",
  "x".repeat(256),
  "x".repeat(257),
  "🧭".repeat(256),
  "🧭".repeat(257),
  [],
  {},
  { unknown: 1 },
  { bowPx: 0 },
  { bowT: 0.5 },
  { bowPx: 0, bowT: 0.5 },
  { bowPx: -180, loopSweepDeg: 180 },
  { bowPx: 181 },
  { loopDirectionDeg: 361 },
  { loopDirectionDeg: 360 },
  { loopSweepDeg: 20 },
  { loopSweepDeg: 19 },
];
verify(fixture(), "complete valid document");
verify(createEmptyGraphModel(), "empty document");
for (const section of [
  "model",
  "node",
  "edge",
  "settings",
  "routing",
] as const) {
  const keys =
    section === "model"
      ? ["version", "nodes", "edges", "settings", "extra"]
      : section === "node"
        ? ["id", "label", "order", "x", "y", "color", "extra"]
        : section === "edge"
          ? [
              "id",
              "source",
              "target",
              "weight",
              "label",
              "color",
              "routing",
              "extra",
            ]
          : section === "settings"
            ? [...Object.keys(fixture().settings), "extra"]
            : ["bowPx", "bowT", "loopDirectionDeg", "loopSweepDeg", "extra"];
  for (const key of keys) {
    for (const value of values) {
      const graph = fixture();
      const target = (
        section === "model"
          ? graph
          : section === "node"
            ? graph.nodes[0]
            : section === "edge"
              ? graph.edges[0]
              : section === "settings"
                ? graph.settings
                : graph.edges[0]!.routing
      ) as Record<string, unknown>;
      target[key] = value;
      verify(graph, `${section}.${key}=${String(value)}`);
    }
    const graph = fixture();
    const target = (
      section === "model"
        ? graph
        : section === "node"
          ? graph.nodes[0]
          : section === "edge"
            ? graph.edges[0]
            : section === "settings"
              ? graph.settings
              : graph.edges[0]!.routing
    ) as Record<string, unknown>;
    delete target[key];
    verify(graph, `missing ${section}.${key}`);
  }
}
for (const key of ["id", "order"] as const) {
  const graph = fixture();
  Object.assign(graph.nodes[1]!, { [key]: graph.nodes[0]![key] });
  verify(graph, `duplicate node ${key}`);
}
for (const [key, value] of [
  ["id", "a"],
  ["id", "aa"],
  ["source", "missing"],
  ["target", "missing"],
]) {
  const graph = fixture();
  Object.assign(graph.edges[0]!, { [key!]: value });
  verify(graph, `edge reference ${key}=${value}`);
}
for (const section of [
  "model",
  "node",
  "edge",
  "settings",
  "routing",
] as const) {
  for (const mode of ["undefined", "non-enumerable", "inherited"] as const) {
    const graph = fixture();
    const target = (
      section === "model"
        ? graph
        : section === "node"
          ? graph.nodes[0]
          : section === "edge"
            ? graph.edges[0]
            : section === "settings"
              ? graph.settings
              : graph.edges[0]!.routing
    ) as Record<string, unknown>;
    if (mode === "undefined") target.extra = undefined;
    else {
      const key = Object.keys(target)[0]!;
      const value = target[key];
      delete target[key];
      if (mode === "inherited") Object.setPrototypeOf(target, { [key]: value });
      else Object.defineProperty(target, key, { value });
    }
    verify(graph, `${section} ${mode} property`);
  }
}
const mutable = fixture();
serializeGraphModel(mutable);
mutable.nodes[0]!.x = Infinity;
verify(mutable, "same model reference changed after validation");
mutable.nodes[0]!.x = 12;
mutable.edges[0]!.routing!.bowPx = 999;
verify(mutable, "nested routing changed after validation");
verifyIndependentContracts();
verifyArrayMethodContracts();
verifyAccessorContracts();
console.log(
  `Graph serialization verification passed (${cases} differential cases plus independent contract boundaries)`,
);

function verifyIndependentContracts() {
  const accepted = (graph: GraphModel) =>
    assert.equal(serializeGraphModel(graph), JSON.stringify(graph));
  const rejected = (graph: GraphModel, reason = "invalid-graph") =>
    assert.throws(
      () => serializeGraphModel(graph),
      (error) => error instanceof GraphContractError && error.reason === reason,
    );
  accepted(createEmptyGraphModel());
  for (let mask = 0; mask < 16; mask++) {
    const graph = fixture();
    const edge = graph.edges[0]!;
    for (const [index, key] of [
      "weight",
      "label",
      "color",
      "routing",
    ].entries())
      if (!(mask & (1 << index)))
        delete (edge as Record<string, unknown>)[key!];
    accepted(graph);
    Object.assign(edge, { extra: undefined });
    for (const key of ["weight", "label", "color", "routing"])
      if (!Object.hasOwn(edge, key))
        (edge as Record<string, unknown>)[key] = undefined;
    accepted(graph);
  }
  for (const color of [undefined, "paper", "red"] as const) {
    const graph = fixture();
    graph.nodes[0]!.color = color;
    accepted(graph);
  }
  for (const key of Object.keys(fixture().settings)) {
    const graph = fixture();
    delete (graph.settings as unknown as Record<string, unknown>)[key];
    rejected(graph);
  }
  const settingsExtra = fixture();
  Object.assign(settingsExtra.settings, { extra: undefined });
  rejected(settingsExtra);
  for (const [routing, valid] of [
    [{ bowPx: 0 }, true],
    [{ bowPx: 0, bowT: 0.5 }, true],
    [{ bowT: 0.5 }, false],
    [{}, false],
    [{ bowPx: 0, bowT: undefined }, false],
    [{ loopDirectionDeg: 360, loopSweepDeg: 20 }, true],
    [{ loopDirectionDeg: 361 }, false],
  ] as const) {
    const graph = fixture();
    graph.edges[0]!.routing = routing;
    if (valid) accepted(graph);
    else rejected(graph);
  }
  for (const [section, key] of [
    ["node", "id"],
    ["node", "x"],
    ["edge", "source"],
  ] as const) {
    const graph = fixture();
    const item = (
      section === "node" ? graph.nodes[0] : graph.edges[0]
    ) as Record<string, unknown>;
    const value = item[key];
    delete item[key];
    Object.setPrototypeOf(item, { [key]: value });

    rejected(graph);
  }
  const nodes = {
    ...createEmptyGraphModel(),
    nodes: Array.from({ length: 1000 }, (_, order) => ({
      id: `n${order}`,
      label: "",
      order,
      x: order,
      y: 0,
    })),
  };
  accepted(nodes);
  rejected({
    ...nodes,
    nodes: [...nodes.nodes, { ...nodes.nodes[0]!, id: "extra", order: 1000 }],
  });
  const edges = {
    ...nodes,
    edges: Array.from({ length: 5000 }, (_, index) => ({
      id: `e${index}`,
      source: "n0",
      target: "n1",
    })),
  };
  accepted(edges);
  rejected({
    ...edges,
    edges: [...edges.edges, { id: "extra", source: "n0", target: "n1" }],
  });
  const sized = {
    ...createEmptyGraphModel(),
    nodes: [{ id: "x", label: "", order: 0, x: 0, y: 0 }],
  };
  sized.nodes[0]!.id += "x".repeat(
    GRAPH_MAX_JSON_CHARS - JSON.stringify(sized).length,
  );
  accepted(sized);
  sized.nodes[0]!.id += "x";
  rejected(sized);
  sized.nodes[0]!.x = Infinity;
  rejected(sized, "coordinate-range");
}

function verifyArrayMethodContracts() {
  const accepted = (graph: GraphModel, label: string) => {
    verify(graph, label);
    assert.equal(serializeGraphModel(graph), JSON.stringify(graph), label);
  };
  const rejected = (
    graph: GraphModel,
    label: string,
    reason = "invalid-graph",
  ) => {
    verify(graph, label);
    assert.throws(
      () => serializeGraphModel(graph),
      (error) => error instanceof GraphContractError && error.reason === reason,
      label,
    );
  };
  for (const section of ["nodes", "edges"] as const) {
    const equivalent = fixture();
    const canonical = equivalent[section].slice();
    Object.defineProperty(equivalent[section], Symbol.iterator, {
      value: function* () {
        yield* canonical;
      },
    });
    accepted(equivalent, `${section}: equivalent custom iterator`);

    const mismatched = fixture();
    const validEntries = mismatched[section].slice();
    if (section === "nodes")
      mismatched.nodes[0] = { ...mismatched.nodes[0]!, x: NaN };
    else mismatched.edges[0] = { ...mismatched.edges[0]!, target: "missing" };
    Object.defineProperty(mismatched[section], Symbol.iterator, {
      value: function* () {
        yield* validEntries;
      },
    });
    rejected(
      mismatched,
      `${section}: invalid numeric entries with valid iterator`,
      section === "nodes" ? "coordinate-range" : "invalid-graph",
    );

    const invalidIteration = fixture();
    const invalidEntries = invalidIteration[section].slice();
    if (section === "nodes") Object.assign(invalidEntries[0]!, { x: NaN });
    else Object.assign(invalidEntries[0]!, { target: "missing" });

    if (section === "nodes") invalidIteration.nodes = fixture().nodes;
    else invalidIteration.edges = fixture().edges;
    Object.defineProperty(invalidIteration[section], Symbol.iterator, {
      value: function* () {
        yield* invalidEntries;
      },
    });
    rejected(
      invalidIteration,
      `${section}: valid numeric entries with invalid iterator`,
    );

    const customEvery = fixture();
    Object.assign(customEvery[section][0]!, { extra: 1 });
    Object.defineProperty(customEvery[section], "every", { value: () => true });
    accepted(
      customEvery,
      `${section}: custom every preserves legacy acceptance`,
    );

    const rejectingEvery = fixture();
    Object.defineProperty(rejectingEvery[section], "every", {
      value: () => false,
    });
    rejected(
      rejectingEvery,
      `${section}: custom every rejects canonical entries`,
    );

    for (const method of [Symbol.iterator, "every"] as const) {
      for (const value of [null, 17]) {
        const nonCallable = fixture();
        Object.defineProperty(nonCallable[section], method, { value });
        const label = `${section}: non-callable ${String(method)}=${value}`;
        verify(nonCallable, label);
        assert.throws(() => serializeGraphModel(nonCallable), TypeError, label);
      }
    }
  }

  class NativeArray<T> extends Array<T> {}
  const subclass = fixture();
  subclass.nodes = NativeArray.from(subclass.nodes);
  subclass.edges = NativeArray.from(subclass.edges);
  accepted(subclass, "native-method Array subclasses");

  for (const method of [Symbol.iterator, "every"] as const) {
    const oversized = createEmptyGraphModel();
    oversized.nodes = [
      { id: "a".repeat(GRAPH_MAX_JSON_CHARS), label: "", order: 0, x: 0, y: 0 },
    ];
    Object.defineProperty(oversized.nodes, method, { value: null });
    const label = `oversized JSON with non-callable ${String(method)}`;
    verify(oversized, label);
    if (method === Symbol.iterator)
      assert.throws(() => serializeGraphModel(oversized), TypeError, label);
    else rejected(oversized, label);
  }
}

function verifyAccessorContracts() {
  type AccessorFixture = { graph: GraphModel; reads: () => number };
  type Expected =
    | { accepted: true; reads: number }
    | { error: string; message: string; reads: number; reason?: string };

  const observe = (
    serialize: typeof serializeGraphModel,
    make: () => AccessorFixture,
  ) => {
    const { graph, reads } = make();
    try {
      return { text: serialize(graph), reads: reads() };
    } catch (error) {
      const thrown = error as Error & { reason?: string };
      return {
        error: thrown.name,
        message: thrown.message,
        ...(thrown.reason ? { reason: thrown.reason } : {}),
        reads: reads(),
      };
    }
  };
  const verifyFactory = (
    make: () => AccessorFixture,
    label: string,
    expected?: Expected,
  ) => {
    const actual = observe(serializeGraphModel, make);
    assert.deepEqual(actual, observe(reference, make), label);
    if (original)
      assert.deepEqual(
        actual,
        observe(original.serializeGraphModel, make),
        `${label}: untouched original serializer`,
      );
    if (expected) {
      if ("accepted" in expected) {
        assert.equal(typeof actual.text, "string", label);
        assert.equal(actual.reads, expected.reads, label);
      } else assert.deepEqual(actual, expected, label);
    }
    cases++;
    return actual;
  };

  verifyFactory(
    () => {
      const graph = createEmptyGraphModel();
      let reads = 0;
      Object.defineProperty(graph.settings, "directed", {
        enumerable: true,
        get() {
          if (++reads === 3) throw new Error("third directed read");
          return false;
        },
      });
      return { graph, reads: () => reads };
    },
    "settings getter retains normalization reads and exception",
    { error: "Error", message: "third directed read", reads: 3 },
  );
  verifyFactory(
    () => {
      const graph = createEmptyGraphModel();
      let reads = 0;
      Object.defineProperty(graph.nodes, Symbol.iterator, {
        get() {
          if (++reads > 1) throw new Error("second iterator read");
          return Array.prototype[Symbol.iterator];
        },
      });
      return { graph, reads: () => reads };
    },
    "iterator getter is not read by fast-path classification",
    { accepted: true, reads: 1 },
  );
  verifyFactory(
    () => {
      const graph = createEmptyGraphModel();
      Object.assign(graph, { version: 2 });
      let reads = 0;
      Object.defineProperty(graph.nodes, "every", {
        get() {
          reads++;
          throw new Error("unused every");
        },
      });
      return { graph, reads: () => reads };
    },
    "invalid version rejects before an unused every getter",
    {
      error: "GraphContractError",
      message: "Graph exceeds the JSON contract",
      reason: "invalid-graph",
      reads: 0,
    },
  );

  verifyFactory(
    () => {
      const graph = createEmptyGraphModel();
      let reads = 0;
      Object.defineProperty(graph, "toJSON", { value: () => undefined });
      Object.defineProperty(graph, "nodes", {
        enumerable: true,
        get() {
          reads++;
          throw new Error("legacy node read");
        },
      });
      return { graph, reads: () => reads };
    },
    "undefined JSON still normalizes before reading raw.length",
    { error: "Error", message: "legacy node read", reads: 1 },
  );
  const undefinedJson = verifyFactory(() => {
    const graph = createEmptyGraphModel();
    Object.defineProperty(graph, "toJSON", { value: () => undefined });
    return { graph, reads: () => 0 };
  }, "undefined JSON with an ordinary graph retains TypeError");
  assert.equal("error" in undefinedJson && undefinedJson.error, "TypeError");
  assert.equal(undefinedJson.reads, 0);

  for (const section of [
    "model",
    "node",
    "edge",
    "settings",
    "routing",
  ] as const) {
    for (const throws of [false, true]) {
      verifyFactory(
        () => {
          const graph = fixture();
          const [target, key] =
            section === "model"
              ? [graph, "nodes"]
              : section === "node"
                ? [graph.nodes[0]!, "label"]
                : section === "edge"
                  ? [graph.edges[0]!, "label"]
                  : section === "settings"
                    ? [graph.settings, "directed"]
                    : [graph.edges[0]!.routing!, "bowPx"];
          const value = (target as unknown as Record<string, unknown>)[key!];
          let reads = 0;
          Object.defineProperty(target, key!, {
            enumerable: true,
            get() {
              if (++reads === 2 && throws)
                throw new Error(`${section} getter second read`);
              return value;
            },
          });
          return { graph, reads: () => reads };
        },
        `${section} own getter: ${throws ? "throws" : "stable value"}`,
      );
    }
  }
  for (const section of ["nodes", "edges"] as const) {
    verifyFactory(
      () => {
        const graph = fixture();
        const value = graph[section][0];
        let reads = 0;
        Object.defineProperty(graph[section], "0", {
          enumerable: true,
          get() {
            reads++;
            return value;
          },
        });
        return { graph, reads: () => reads };
      },
      `${section} numeric getter retains JSON, iterator and every reads`,
      { accepted: true, reads: 3 },
    );
  }
  verifyFactory(
    () => {
      const graph = fixture();
      serializeGraphModel(graph);
      let reads = 0;
      Object.defineProperty(graph.nodes[0]!, "label", {
        enumerable: true,
        get() {
          if (++reads === 2) throw new Error("getter added after validation");
          return "changed label";
        },
      });
      return { graph, reads: () => reads };
    },
    "prior validation does not trust a model after a getter is installed",
    { error: "Error", message: "getter added after validation", reads: 2 },
  );
  verifyFactory(
    () => {
      const graph = fixture();
      let reads = 0;
      Object.defineProperty(graph.nodes[0]!, "unused", {
        get() {
          reads++;
          throw new Error("non-enumerable getter must remain unread");
        },
      });
      return { graph, reads: () => reads };
    },
    "classifying data does not invoke ignored non-enumerable accessors",
    { accepted: true, reads: 0 },
  );
}
