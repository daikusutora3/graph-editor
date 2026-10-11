import type { KeyboardEvent } from "react";

/**
 * Arrow-key navigation for radio-style groups (WAI-ARIA "roving tabindex").
 * Attach the returned handler to the group; give the selected item
 * tabIndex 0 and the rest -1 so the group is one tab stop.
 */
export function rovingFocusKeyDown(
  event: KeyboardEvent<HTMLElement>,
  itemSelector = "[role='radio']",
) {
  const keys = [
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "Home",
    "End",
  ];

  if (!keys.includes(event.key)) {
    return;
  }

  const items = [
    ...event.currentTarget.querySelectorAll<HTMLElement>(itemSelector),
  ].filter((item) => !item.hasAttribute("disabled"));

  if (items.length === 0) {
    return;
  }

  const index = items.indexOf(document.activeElement as HTMLElement);
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : event.key === "ArrowRight" || event.key === "ArrowDown"
          ? (Math.max(index, 0) + 1) % items.length
          : (Math.max(index, 0) - 1 + items.length) % items.length;

  event.preventDefault();
  items[next]?.focus();
  items[next]?.click();
}
