export type EditorLayout = "desktop" | "compact" | "mobile";

export const MOBILE_LAYOUT_MAX_WIDTH = 768;
export const COMPACT_LAYOUT_MAX_WIDTH = 1280;

export function resolveEditorLayout(width: number): EditorLayout {
  if (width > 0 && width < MOBILE_LAYOUT_MAX_WIDTH) {
    return "mobile";
  }

  if (width > 0 && width < COMPACT_LAYOUT_MAX_WIDTH) {
    return "compact";
  }

  return "desktop";
}

export type EditorPanel =
  | "layouts"
  | "settings"
  | "menu"
  | "export"
  | "png"
  | "starter"
  | "shortcuts";

export function toggleEditorPanel(
  current: EditorPanel | null,
  panel: EditorPanel,
): EditorPanel | null {
  return current === panel ? null : panel;
}
