/**
 * Shared class fragments for the chrome design system.
 * Keep visual constants here so every primitive reads from one place.
 */
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--accent-ring)]";

export const panelSurface =
  "border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow)]";

export const solidSurface =
  "border border-[var(--line)] bg-[var(--panel-solid)] shadow-[var(--shadow)]";

export const controlRadius = {
  panel: "rounded-xl",
  control: "rounded-[9px]",
  input: "rounded-lg",
  chip: "rounded-md",
} as const;
