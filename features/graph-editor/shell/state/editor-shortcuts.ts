import type { EditorPanel } from "./editor-layout";
import type { EditorMode } from "./editor-state";

type EditorShortcutEvent = {
  ctrlKey: boolean;
  key: string;
  metaKey: boolean;
  shiftKey: boolean;
};

export type GraphEditorShortcut =
  | { type: "undo" }
  | { type: "redo" }
  | { type: "select-all" }
  | { type: "copy-selection" }
  | { type: "cut-selection" }
  | { type: "paste-clipboard" }
  | { type: "set-mode"; mode: EditorMode }
  | { type: "cycle-selection-color" }
  | { type: "clear-interaction" }
  | { type: "delete-selection" }
  | { type: "edit-selection" }
  | { type: "toggle-panel"; panel: EditorPanel }
  | { type: "fit-view" }
  | { type: "reset-zoom" }
  | { type: "nudge-selection"; dx: number; dy: number };

const ARROW_KEY_TO_DELTA: Record<string, { dx: number; dy: number }> = {
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
};

const MODE_KEY_TO_MODE: Record<string, EditorMode> = {
  e: "edge",
  n: "node",
  v: "select",
};

const PANEL_KEY_TO_PANEL: Record<string, EditorPanel> = {
  l: "layouts",
  ",": "settings",
  "?": "shortcuts",
};

export function resolveGraphEditorShortcut(
  event: EditorShortcutEvent,
): GraphEditorShortcut | null {
  const key = event.key.toLowerCase();

  if (event.metaKey || event.ctrlKey) {
    if (key === "z") {
      return event.shiftKey ? { type: "redo" } : { type: "undo" };
    }

    if (key === "y" && event.ctrlKey && !event.metaKey) {
      return { type: "redo" };
    }

    if (key === "a") {
      return { type: "select-all" };
    }

    if (key === "c") {
      return { type: "copy-selection" };
    }

    if (key === "x") {
      return { type: "cut-selection" };
    }

    if (key === "v") {
      return { type: "paste-clipboard" };
    }

    if (key === "0") {
      return { type: "reset-zoom" };
    }

    return null;
  }

  if (event.key === "!" || (event.key === "1" && event.shiftKey)) {
    return { type: "fit-view" };
  }

  const panel = PANEL_KEY_TO_PANEL[event.key === "?" ? "?" : key];
  if (panel) {
    return { type: "toggle-panel", panel };
  }

  const mode = MODE_KEY_TO_MODE[key];
  if (mode) {
    return { type: "set-mode", mode };
  }

  if (key === "c") {
    return { type: "cycle-selection-color" };
  }

  if (event.key === "Escape") {
    return { type: "clear-interaction" };
  }

  if (event.key === "Delete" || event.key === "Backspace") {
    return { type: "delete-selection" };
  }

  if (event.key === "Enter") {
    return { type: "edit-selection" };
  }

  const arrowDelta = ARROW_KEY_TO_DELTA[event.key];
  if (arrowDelta) {
    const step = event.shiftKey ? 10 : 1;
    return {
      type: "nudge-selection",
      dx: arrowDelta.dx * step,
      dy: arrowDelta.dy * step,
    };
  }

  return null;
}

export function shouldPreventDefaultForGraphEditorShortcut(
  shortcut: GraphEditorShortcut,
  consumed: boolean,
) {
  switch (shortcut.type) {
    case "undo":
    case "redo":
    case "select-all":
      return true;
    case "reset-zoom":
      return true;
    case "copy-selection":
    case "cut-selection":
    case "paste-clipboard":
    case "cycle-selection-color":
    case "nudge-selection":
    case "edit-selection":
    case "fit-view":
    case "toggle-panel":
      return consumed;
    case "set-mode":
    case "clear-interaction":
    case "delete-selection":
      return false;
  }
}
