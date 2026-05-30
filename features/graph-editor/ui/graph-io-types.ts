export type CopyState = "idle" | "copied" | "blocked";
export type PngExportBackground = "white" | "black" | "transparent";
export type PngExportLongEdgePreset = 640 | 1024 | 1600 | "custom";
export type PngExportPaddingPreset = 0 | 24 | 48 | 96 | "custom";
export const PNG_EXPORT_LONG_EDGE_PRESETS = [640, 1024, 1600] as const;
export const PNG_EXPORT_PADDING_PRESETS = [0, 24, 48, 96] as const;
export const DEFAULT_LONG_EDGE_PX = 1024;
export const DEFAULT_PADDING_PX = 48;
export const MIN_LONG_EDGE_PX = 320;
export const MAX_LONG_EDGE_PX = 3000;
export const MIN_PADDING_PX = 0;
export const MAX_PADDING_PX = 320;
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
