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
  control: "rounded-lg",
  input: "rounded-lg",
  chip: "rounded-md",
} as const;

/** Secondary (raised) control: white face, hairline border, soft shadow.
 * Used for every clickable choice or secondary action so "raised = pressable"
 * reads the same in every panel. */
export const raisedControl =
  "border border-[var(--line)] bg-[var(--panel-solid)] text-[var(--text)] shadow-[0_1px_2px_rgb(0_0_0/0.06)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent-text)] active:translate-y-px";

/** Disabled control: no face, no border, faded label. Never a grey fill so
 * disabled states are not confused with secondary buttons or inputs. */
export const disabledControl =
  "cursor-default border border-transparent bg-transparent text-[var(--faint)] shadow-none";
