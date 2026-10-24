export const HINT_STORAGE_PREFIX = "graph-editor-hint-learned:";
export const HINTS_RESET_EVENT = "graph-editor:hints-reset";

export function resetLearnedHints() {
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith(HINT_STORAGE_PREFIX)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {}

  window.dispatchEvent(new Event(HINTS_RESET_EVENT));
}
