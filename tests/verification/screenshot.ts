import {
  MAX_LONG_EDGE_PX,
  PNG_EXPORT_LONG_EDGE_PRESETS,
} from "../../features/graph-editor/ui/io/graph-io-types";
import {
  clampLongEdgePx,
  clampPaddingPx,
  clampPaddingPxForLongEdge,
  createEmptyScreenshotPreview,
  makeScreenshotInputKey,
  resolvePngCanvasLayout,
} from "../../features/graph-editor/ui/io/graph-io-screenshot-state";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("Screenshot");

verifyPreviewInputKey();
verifyPreviewStateHelpers();
verifyScreenshotSizingHelpers();

const naturalLayout = resolvePngCanvasLayout(320, 180, 24);
const fixedLayout = resolvePngCanvasLayout(320, 180, 24, 640, 360);
expect(
  naturalLayout.width === 368 &&
    naturalLayout.height === 228 &&
    fixedLayout.width === 640 &&
    fixedLayout.height === 360 &&
    fixedLayout.x === 160 &&
    fixedLayout.y === 90,
  "natural export should preserve graph pixels and center them in a fixed canvas",
);
let rejectedSmallCanvas = false;
try {
  resolvePngCanvasLayout(320, 180, 24, 300, 300);
} catch {
  rejectedSmallCanvas = true;
}
expect(rejectedSmallCanvas, "fixed canvas must not silently crop the graph");

finish();

function verifyPreviewInputKey() {
  const baseKey = makeScreenshotInputKey({
    background: "white",
    graphRevision: 7,
    longEdgePx: 1024,
    paddingPx: 48,
    scope: "viewport",
    theme: "light",
  });

  expect(
    baseKey !==
      makeScreenshotInputKey({
        background: "black",
        graphRevision: 7,
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
        graphRevision: 7,
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
        graphRevision: 7,
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
        graphRevision: 8,
        longEdgePx: 1024,
        paddingPx: 48,
        scope: "viewport",
        theme: "light",
      }),
    "preview input key should include graph revision",
  );
  expect(
    baseKey !==
      makeScreenshotInputKey({
        background: "white",
        graphRevision: 7,
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
        graphRevision: 7,
        longEdgePx: 1024,
        paddingPx: 48,
        scope: "full",
        theme: "light",
      }),
    "preview input key should include export scope",
  );
  for (const scope of [
    "full",
    "viewport",
    "natural",
    "natural-fixed",
  ] as const) {
    const input = {
      background: "white" as const,
      graphRevision: 7,
      longEdgePx: 1920,
      paddingPx: 24,
      scope,
      theme: "light" as const,
    };
    const snapshots = {
      ...input,
      viewportSignature: "[0.5,0,0,1440,1000,1]",
      exportScaleSignature: "[0.5,1]",
    };
    const initialKey = makeScreenshotInputKey(snapshots);
    expect(
      (initialKey ===
        makeScreenshotInputKey({
          ...snapshots,
          viewportSignature: "[0.504,0,0,1440,1000,1]",
          exportScaleSignature: "[0.504,1]",
        })) ===
        (scope === "full"),
      "non-fixed-size previews must notice exact zoom changes within a rounded percent",
    );
    expect(
      (initialKey ===
        makeScreenshotInputKey({
          ...snapshots,
          viewportSignature: "[0.5,0,0,1440,1000,2]",
          exportScaleSignature: "[0.5,2]",
        })) ===
        (scope === "full"),
      "only fixed-size full previews ignore screen pixel density changes",
    );
    for (const viewportSignature of [
      "[0.5,80,40,1440,1000,1]",
      "[0.5,0,0,1400,900,1]",
    ]) {
      expect(
        (initialKey ===
          makeScreenshotInputKey({ ...snapshots, viewportSignature })) ===
          (scope !== "viewport"),
        "only viewport previews depend on canvas pan and dimensions",
      );
    }
  }
  expect(
    makeScreenshotInputKey({
      background: "transparent",
      graphRevision: 7,
      longEdgePx: 1024,
      paddingPx: 48,
      scope: "viewport",
      theme: "light",
    }) !==
      makeScreenshotInputKey({
        background: "transparent",
        graphRevision: 7,
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
}

function verifyScreenshotSizingHelpers() {
  expect(
    clampLongEdgePx(Number.NaN) === 1920 &&
      clampLongEdgePx(1) === 480 &&
      clampLongEdgePx(10_000) === MAX_LONG_EDGE_PX,
    "long-edge values should clamp to supported bounds",
  );
  expect(
    PNG_EXPORT_LONG_EDGE_PRESETS.length === 4 &&
      PNG_EXPORT_LONG_EDGE_PRESETS.includes(3840),
    "long-edge presets should stay compact while keeping a large option",
  );
  expect(
    clampPaddingPx(Number.NaN) === 24 &&
      clampPaddingPx(-1) === 0 &&
      clampPaddingPx(999) === 160,
    "padding values should clamp to supported bounds",
  );
  expect(
    clampPaddingPxForLongEdge(100, 101) === 50,
    "padding should be capped so at least one content pixel remains",
  );
}
