import type { GraphModel } from "../core/graph/model";
import type { ThemeMode } from "./theme";
import type {
  PngExportBackground,
  PngExportLongEdgePreset,
  PngExportPaddingPreset,
  PngExportScope,
  ScreenshotPreview,
} from "./graph-io-types";
import {
  DEFAULT_LONG_EDGE_PX,
  DEFAULT_PADDING_PX,
  MAX_LONG_EDGE_PX,
  MAX_PADDING_PX,
  MIN_LONG_EDGE_PX,
  MIN_PADDING_PX,
} from "./graph-io-types";

export type ScreenshotPreviewInput = {
  background: PngExportBackground;
  graph: GraphModel;
  longEdgePx: number;
  paddingPx: number;
  scope: PngExportScope;
  theme: ThemeMode;
};

export function createEmptyScreenshotPreview(): ScreenshotPreview {
  return {
    height: null,
    inputKey: null,
    state: "empty",
    url: "",
    width: null,
  };
}

export function makeScreenshotInputKey({
  background,
  graph,
  longEdgePx,
  paddingPx,
  scope,
  theme,
}: ScreenshotPreviewInput) {
  return JSON.stringify({
    background,
    edges: graph.edges,
    longEdgePx,
    nodes: graph.nodes,
    paddingPx,
    scope,
    settings: graph.settings,
    theme,
  });
}

export function isScreenshotPreviewStale(
  preview: ScreenshotPreview,
  currentInputKey: string,
) {
  return preview.state === "ready" && preview.inputKey !== currentInputKey;
}

export function shouldAcceptScreenshotPreviewRequest(
  currentRequestId: number,
  requestId: number,
) {
  return currentRequestId === requestId;
}

export function resolveLongEdgePx(
  preset: PngExportLongEdgePreset,
  customLongEdgePx: number,
) {
  return preset === "custom" ? customLongEdgePx : preset;
}

export function resolvePaddingPx(
  preset: PngExportPaddingPreset,
  customPaddingPx: number,
) {
  return preset === "custom" ? customPaddingPx : preset;
}

export function clampLongEdgePx(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_LONG_EDGE_PX;
  }

  return Math.min(
    MAX_LONG_EDGE_PX,
    Math.max(MIN_LONG_EDGE_PX, Math.round(value)),
  );
}

export function clampPaddingPx(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_PADDING_PX;
  }

  return Math.min(MAX_PADDING_PX, Math.max(MIN_PADDING_PX, Math.round(value)));
}

export function clampPaddingPxForLongEdge(
  paddingPx: number,
  longEdgePx: number,
) {
  return Math.min(paddingPx, Math.max(0, Math.floor((longEdgePx - 1) / 2)));
}
