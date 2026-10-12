/**
 * Shared class fragments for the chrome design system.
 * Keep visual constants here so every primitive reads from one place.
 */
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--accent-ring)]";

export const panelSurface = "border border-[var(--line)] bg-[var(--panel)]";

export const solidSurface =
  "border border-[var(--line)] bg-[var(--panel-solid)]";

/** Secondary control: white face and hairline border.
 * Used for clickable choices and secondary actions across panels. */
export const raisedControl =
  "border border-[var(--line)] bg-[var(--panel-solid)] text-[var(--text)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent-text)] active:translate-y-px";

/** Disabled control: no face, no border, faded label. Never a grey fill so
 * disabled states are not confused with secondary buttons or inputs. */
export const disabledControl =
  "cursor-default border border-transparent bg-transparent text-[var(--faint)] shadow-none";

/** One optical weight for UI icons; brand artwork keeps its own geometry. */
export const controlIcon =
  "[&_.lucide]:shrink-0 [&_.lucide]:[stroke-width:1.75]";
export const rowControl =
  "flex min-h-10 w-full items-center gap-2.5 rounded-lg text-left text-control font-medium transition-colors touch:min-h-11 [&_.lucide]:shrink-0 [&_.lucide]:[stroke-width:1.75]";
