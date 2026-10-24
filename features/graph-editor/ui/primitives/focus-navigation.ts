import type { KeyboardEvent } from "react";

const FOCUSABLE_SELECTOR =
  "button,input,select,textarea,a[href],summary,[tabindex]";

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

export function tabbableElements(root: HTMLElement | null) {
  return root
    ? [...root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
        (element) => element.tabIndex >= 0 && availableForFocus(element),
      )
    : [];
}

export function trapFocusKeyDown(
  event: KeyboardEvent<HTMLElement>,
  root: HTMLElement | null,
) {
  if (
    !root ||
    event.key !== "Tab" ||
    event.defaultPrevented ||
    event.ctrlKey ||
    event.altKey ||
    event.metaKey ||
    event.nativeEvent.isComposing
  ) {
    return;
  }

  const elements = tabbableElements(root);
  event.preventDefault();
  if (elements.length === 0) {
    root.focus();
    return;
  }
  const index = elements.indexOf(
    root.ownerDocument.activeElement as HTMLElement,
  );
  const next = event.shiftKey
    ? index < 0
      ? elements.length - 1
      : (index - 1 + elements.length) % elements.length
    : (index + 1) % elements.length;

  elements[next]?.focus();
}

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
