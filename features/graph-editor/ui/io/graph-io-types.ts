export type CopyState = "idle" | "copied" | "blocked";
export type PngExportBackground = "white" | "black" | "transparent";
export type PngExportScope = "viewport" | "full";
export type PngExportLongEdgePreset = 1280 | 1920 | 2560 | 3840 | "custom";
export type PngExportPaddingPreset = 0 | 24 | 48 | "custom";
export const PNG_EXPORT_LONG_EDGE_PRESETS = [1280, 1920, 2560, 3840] as const;
export const PNG_EXPORT_PADDING_PRESETS = [0, 24, 48] as const;
export const DEFAULT_LONG_EDGE_PX = 1920;
export const DEFAULT_PADDING_PX = 24;
export const MIN_LONG_EDGE_PX = 480;
export const MAX_LONG_EDGE_PX = 3840;
export const MIN_PADDING_PX = 0;
export const MAX_PADDING_PX = 160;
export type ScreenshotCopyState =
  | "idle"
  | "copying"
  | "copied"
  | "saved"
  | "blocked";
export type ScreenshotDownloadState = "idle" | "saving" | "saved" | "failed";
type ScreenshotPreviewState = "empty" | "loading" | "ready" | "failed";
export type ScreenshotPreview = {
  height: number | null;
  inputKey: string | null;
  state: ScreenshotPreviewState;
  url: string;
  width: number | null;
};
