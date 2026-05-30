const SHORTCUT_BLOCK_SELECTOR = [
  "input",
  "textarea",
  "select",
  "button",
  "a[href]",
  "[contenteditable='true']",
  "[contenteditable='plaintext-only']",
  "[role='button']",
  "[role='dialog']",
  "[role='menu']",
  "[role='menuitem']",
  "[role='radio']",
  "[role='tab']",
  "[role='textbox']",
  "[aria-modal='true']",
].join(",");

export function isEditorShortcutBlockedTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.closest("[data-graph-shortcut-target='true']")) {
    return false;
  }

  return Boolean(target.closest(SHORTCUT_BLOCK_SELECTOR));
}
