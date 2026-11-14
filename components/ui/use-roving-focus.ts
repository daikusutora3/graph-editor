import type { KeyboardEvent } from "react";

export function rovingFocusKeyDown(event: KeyboardEvent<HTMLElement>) {
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
    ...event.currentTarget.querySelectorAll<HTMLElement>("[role='radio']"),
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
