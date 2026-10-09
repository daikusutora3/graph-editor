import type { KeyboardEvent } from "react";

const FOCUSABLE_SELECTOR = "button,input,select,textarea,a[href],[tabindex]";

function availableForFocus(element: HTMLElement) {
  if (
    element.matches(":disabled,[aria-disabled='true']") ||
    element.closest("[hidden],[inert],[aria-hidden='true']") ||
    element.getClientRects().length === 0
  ) {
    return false;
  }

  const visibility =
    element.ownerDocument.defaultView?.getComputedStyle(element).visibility;
  return visibility !== "hidden" && visibility !== "collapse";
}

/** Native Tab order: each roving radio group contributes only its selected item. */
export function tabbableElements(root: HTMLElement | null) {
  return root
    ? [...root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
        (element) => element.tabIndex >= 0 && availableForFocus(element),
      )
    : [];
}

/** Menu arrows move focus; activation remains with Enter, Space or a click. */
export function menuFocusKeyDown(event: KeyboardEvent<HTMLElement>) {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
    return;
  }

  const menu = event.currentTarget;
  const items = [
    ...menu.querySelectorAll<HTMLElement>(
      "[role='menuitem'],[role='menuitemradio'],[role='menuitemcheckbox']",
    ),
  ].filter(availableForFocus);
  if (items.length === 0) {
    return;
  }

  const index = items.indexOf(menu.ownerDocument.activeElement as HTMLElement);
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : event.key === "ArrowDown"
          ? (index + 1) % items.length
          : (index < 0 ? items.length - 1 : index - 1 + items.length) %
            items.length;

  event.preventDefault();
  items[next]?.focus();
}
