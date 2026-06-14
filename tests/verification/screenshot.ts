import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import {
  MAX_LONG_EDGE_PX,
  PNG_EXPORT_LONG_EDGE_PRESETS,
} from "../../features/graph-editor/ui/graph-io-types";
import {
  clampLongEdgePx,
  clampPaddingPx,
  clampPaddingPxForLongEdge,
  createEmptyScreenshotPreview,
  isScreenshotPreviewStale,
  makeScreenshotInputKey,
  resolveLongEdgePx,
  resolvePaddingPx,
  shouldAcceptScreenshotPreviewRequest,
} from "../../features/graph-editor/ui/graph-io-screenshot-state";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("Screenshot");

verifyPreviewInputKey();
verifyPreviewStateHelpers();
verifyScreenshotSizingHelpers();

finish();

function verifyPreviewInputKey() {
  const graph = graphFixture();
  const baseKey = makeScreenshotInputKey({
    background: "white",
    graph,
    longEdgePx: 1024,
    paddingPx: 48,
    scope: "viewport",
    theme: "light",
  });

  expect(
    baseKey !==
      makeScreenshotInputKey({
        background: "black",
        graph,
        longEdgePx: 1024,
        paddingPx: 48,
        scope: "viewport",
        theme: "light",
      }),
    "preview input key should include background",
  );
  expect(
    baseKey !==
      makeScreenshotInputKey({
        background: "white",
        graph,
        longEdgePx: 1600,
        paddingPx: 48,
        scope: "viewport",
        theme: "light",
      }),
    "preview input key should include long-edge size",
  );
  expect(
    baseKey !==
      makeScreenshotInputKey({
        background: "white",
        graph,
        longEdgePx: 1024,
        paddingPx: 64,
        scope: "viewport",
        theme: "light",
      }),
    "preview input key should include padding",
  );
  expect(
    baseKey !==
      makeScreenshotInputKey({
        background: "white",
        graph: {
          ...graph,
          nodes: [{ ...graph.nodes[0], label: "Changed" }, graph.nodes[1]],
        },
        longEdgePx: 1024,
        paddingPx: 48,
        scope: "viewport",
        theme: "light",
      }),
    "preview input key should include graph content",
  );
  expect(
    baseKey !==
      makeScreenshotInputKey({
        background: "white",
        graph,
        longEdgePx: 1024,
        paddingPx: 48,
        scope: "viewport",
        theme: "dark",
      }),
    "preview input key should include theme",
  );
  expect(
    baseKey !==
      makeScreenshotInputKey({
        background: "white",
        graph,
        longEdgePx: 1024,
        paddingPx: 48,
        scope: "full",
        theme: "light",
      }),
    "preview input key should include export scope",
  );
  expect(
    makeScreenshotInputKey({
      background: "transparent",
      graph,
      longEdgePx: 1024,
      paddingPx: 48,
      scope: "viewport",
      theme: "light",
    }) !==
      makeScreenshotInputKey({
        background: "transparent",
        graph,
        longEdgePx: 1024,
        paddingPx: 48,
        scope: "viewport",
        theme: "dark",
      }),
    "transparent preview input key should still include theme",
  );
}

function verifyPreviewStateHelpers() {
  const emptyPreview = createEmptyScreenshotPreview();
  expect(
    emptyPreview.state === "empty" &&
      emptyPreview.url === "" &&
      emptyPreview.inputKey === null,
    "empty screenshot preview should clear URL and input key",
  );

  expect(
    !isScreenshotPreviewStale(
      { ...emptyPreview, state: "failed", inputKey: "old" },
      "new",
    ),
    "failed previews should not be reported as stale",
  );
  expect(
    !isScreenshotPreviewStale(
      { ...emptyPreview, state: "ready", inputKey: "same" },
      "same",
    ),
    "ready previews with the current input key should not be stale",
  );
  expect(
    isScreenshotPreviewStale(
      { ...emptyPreview, state: "ready", inputKey: "old" },
      "new",
    ),
    "ready previews with an old input key should be stale",
  );
  expect(
    shouldAcceptScreenshotPreviewRequest(3, 3) &&
      !shouldAcceptScreenshotPreviewRequest(4, 3),
    "only the latest screenshot preview request should be accepted",
  );
}

function verifyScreenshotSizingHelpers() {
  expect(
    resolveLongEdgePx(1024, 1600) === 1024 &&
      resolveLongEdgePx("custom", 1600) === 1600,
    "long-edge presets should resolve custom values only for custom mode",
  );
  expect(
    resolvePaddingPx(48, 96) === 48 && resolvePaddingPx("custom", 96) === 96,
    "padding presets should resolve custom values only for custom mode",
  );
  expect(
    clampLongEdgePx(Number.NaN) === 640 &&
      clampLongEdgePx(1) === 320 &&
      clampLongEdgePx(10_000) === MAX_LONG_EDGE_PX,
    "long-edge values should clamp to supported bounds",
  );
  expect(
    PNG_EXPORT_LONG_EDGE_PRESETS.length === 3 &&
      PNG_EXPORT_LONG_EDGE_PRESETS.includes(1024),
    "long-edge presets should stay compact while keeping a large option",
  );
  expect(
    clampPaddingPx(Number.NaN) === 24 &&
      clampPaddingPx(-1) === 0 &&
      clampPaddingPx(999) === 320,
    "padding values should clamp to supported bounds",
  );
  expect(
    clampPaddingPxForLongEdge(100, 101) === 50,
    "padding should be capped so at least one content pixel remains",
  );
}

function graphFixture(): GraphModel {
  return {
    ...createEmptyGraphModel({ directed: true }),
    nodes: [
      { id: "a", label: "A", order: 0, x: 0, y: 0 },
      { id: "b", label: "B", order: 1, x: 120, y: 0 },
    ],
    edges: [{ id: "ab", source: "a", target: "b" }],
  };
}
