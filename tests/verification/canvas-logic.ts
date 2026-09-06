import { nudgeEdgeBend } from "../../features/graph-editor/core/layout/edge-route-geometry";
import { normalizeEdgeWeightInput } from "../../features/graph-editor/core/graph/edit-values";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import { resolveEdgeCreation } from "../../features/graph-editor/canvas/graph-canvas-edge-creation";
import { getEdgeCandidateError } from "../../features/graph-editor/canvas/graph-canvas-edge-draft";
import {
  describeSelection,
  resolveSelectionActions,
} from "../../features/graph-editor/canvas/selection-actions";
import { detectBrowserLocale } from "../../features/graph-editor/i18n/locale";
import { messagesByLocale } from "../../features/graph-editor/i18n/messages";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("Canvas logic");

const base = createEmptyGraphModel();
const graph: GraphModel = {
  ...base,
  settings: { ...base.settings, allowSelfLoops: false, allowMultiEdges: false },
  nodes: [
    { id: "a", label: "A", order: 0, x: 0, y: 0 },
    { id: "b", label: "B", order: 1, x: 100, y: 0 },
    { id: "c", label: "C", order: 2, x: 200, y: 0 },
  ],
  edges: [
    { id: "ab", source: "a", target: "b" },
    { id: "bc", source: "b", target: "c", routing: { bowPx: 40, bowT: 0.5 } },
  ],
};
const messages = messagesByLocale.en;

// --- edge creation state machine -------------------------------------------
const pickSource = resolveEdgeCreation({
  model: graph,
  draft: { sourceNodeId: null },
  targetNodeId: "a",
});
expect(
  pickSource.kind === "update-draft" &&
    pickSource.nextDraft.sourceNodeId === "a" &&
    pickSource.nextDraft.message?.code === "source-selected",
  "first tap in edge mode should pick the source",
);

const selfLoop = resolveEdgeCreation({
  model: graph,
  draft: { sourceNodeId: "a" },
  targetNodeId: "a",
});
expect(
  selfLoop.kind === "reject" && selfLoop.reason === "self-loop",
  "self loops should be rejected unless allowed",
);

const duplicate = resolveEdgeCreation({
  model: graph,
  draft: { sourceNodeId: "a" },
  targetNodeId: "b",
});
expect(
  duplicate.kind === "reject" && duplicate.reason === "duplicate-edge",
  "duplicate edges should be rejected unless allowed",
);

const created = resolveEdgeCreation({
  model: graph,
  draft: { sourceNodeId: "a" },
  targetNodeId: "c",
});
expect(
  created.kind === "create-edge" &&
    created.source === "a" &&
    created.target === "c" &&
    created.nextDraft.sourceNodeId === null,
  "a valid target should create the edge and clear the source",
);

const chained = resolveEdgeCreation({
  model: graph,
  draft: { sourceNodeId: "a" },
  targetNodeId: "c",
  continueFromTarget: true,
});
expect(
  chained.kind === "create-edge" && chained.nextDraft.sourceNodeId === "c",
  "continueFromTarget should keep drawing from the new node",
);

const missing = resolveEdgeCreation({
  model: graph,
  draft: { sourceNodeId: "a" },
  targetNodeId: "zzz",
});
expect(
  missing.kind === "reject" && missing.reason === "target-missing",
  "an unknown target should be reported as missing",
);

expect(
  getEdgeCandidateError(graph, "a", "a") === "self-loop" &&
    getEdgeCandidateError(graph, "a", "b") === "duplicate-edge" &&
    getEdgeCandidateError(graph, "a", "c") === null,
  "hover candidate errors should mirror the creation rules",
);

// --- selection actions -----------------------------------------------------
const edgeActions = resolveSelectionActions(
  graph,
  { nodeIds: [], edgeIds: ["bc"] },
  messages,
);
const ids = edgeActions.map((action) => action.id);
expect(
  ids.includes("edit") &&
    ids.includes("bend-left") &&
    ids.includes("bend-right") &&
    ids.includes("reset-curve") &&
    ids.includes("delete"),
  `a manually bent edge should offer edit, bend, reset and delete (got ${ids.join(",")})`,
);
expect(
  edgeActions
    .filter((action) => action.id.startsWith("bend-"))
    .every((action) => action.menuOnly === true),
  "bend actions should be menu-only",
);
expect(
  !resolveSelectionActions(graph, { nodeIds: [], edgeIds: ["ab"] }, messages)
    .map((action) => action.id)
    .includes("reset-curve"),
  "a straight edge should not offer reset-curve",
);
expect(
  resolveSelectionActions(graph, { nodeIds: ["a"], edgeIds: [] }, messages)
    .map((action) => action.id)
    .join(",") === "edit,delete",
  "a single node should offer edit and delete only",
);

expect(
  describeSelection(graph, { nodeIds: ["a"], edgeIds: [] }, messages) ===
    messages.chrome.selection.node("A") &&
    describeSelection(graph, { nodeIds: [], edgeIds: ["ab"] }, messages) ===
      messages.chrome.selection.edge("A", "B") &&
    describeSelection(
      graph,
      { nodeIds: ["a", "b"], edgeIds: ["ab"] },
      messages,
    ) === messages.chrome.selection.mixed(2, 1),
  "selection descriptions should name nodes and edges",
);

// --- inline edit validation ------------------------------------------------
expect(
  normalizeEdgeWeightInput("abc", "number").error === "invalid-number" &&
    normalizeEdgeWeightInput(" 12 ", "number").value === "12" &&
    normalizeEdgeWeightInput("", "number").value === "1",
  "weight input should validate numbers and default empty to 1",
);

// --- locale detection ------------------------------------------------------
expect(
  detectBrowserLocale(["fr-FR", "zh-CN", "en"]) === "zh-Hans" &&
    detectBrowserLocale(["en-GB"]) === "en" &&
    detectBrowserLocale(["ja-JP"]) === "ja" &&
    detectBrowserLocale(undefined) === "ja",
  "browser locale detection should map regional tags and fall back to Japanese",
);

const autoBend = { controlPointDistancesPx: [128], controlPointWeights: [0.3] };
const nudge = nudgeEdgeBend(undefined, autoBend, 48);
expect(
  nudge?.bowPx === 176 && nudge.bowT === 0.3,
  "menu bend inherits displayed distance and position",
);
expect(
  nudgeEdgeBend(undefined, undefined, 48) === null,
  "no route means no speculative bend",
);
const manualNudge = nudgeEdgeBend({ bowPx: -128, bowT: 0.7 }, autoBend, -48);
expect(
  manualNudge?.bowPx === -176 && manualNudge.bowT === 0.7,
  "manual and reversed direction keep their own starting curve",
);
finish();
