import { cn } from "@/lib/utils";

export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]";

export const pressFeedback =
  "enabled:not-aria-disabled:active:[background-image:linear-gradient(color-mix(in_srgb,currentColor_10%,transparent),color-mix(in_srgb,currentColor_10%,transparent))] motion-reduce:transition-none";

// Text fields share the raised control face (white with --control-border) so they sit
// alongside secondary buttons; the border keeps 3:1 contrast on every surface.
export const fieldSurface =
  "border border-[var(--control-border)] bg-[var(--panel-solid)] transition-colors hover:border-[var(--muted)]";

export const fieldLabel =
  "min-w-0 text-control font-medium [overflow-wrap:anywhere] text-[var(--muted)]";

export const controlIcon =
  "[&_.lucide]:shrink-0 [&_.lucide]:[stroke-width:1.75]";
export const rowControl =
  "flex min-h-10 w-full items-center gap-2.5 rounded-lg text-left text-control font-medium transition-colors touch:min-h-11 [&_.lucide]:shrink-0 [&_.lucide]:[stroke-width:1.75]";

/** The groove behind a set of mutually exclusive options (Segment, slider presets). */
export const segmentTrack =
  "grid min-w-0 auto-cols-[minmax(0,1fr)] grid-flow-col gap-0.5 rounded-xl bg-[var(--fill)] p-0.5";

/** One option inside `segmentTrack`; selected options are raised in white with an accent edge. */
export function segmentItem(selected: boolean) {
  return cn(
    "flex min-w-0 items-center justify-center rounded-lg border px-0.5 text-control font-semibold transition-colors touch:min-h-11",
    "focus-visible:relative focus-visible:z-10",
    focusRing,
    pressFeedback,
    selected
      ? "border-[var(--control-accent)] bg-[var(--panel-solid)] text-[var(--accent-text)]"
      : "border-transparent text-[var(--muted)] hover:text-[var(--text)]",
  );
}

/**
 * Split button: a main action joined to a small menu trigger. Put `splitStart`
 * on the main button and `splitEnd` on the trigger; the trigger draws a thin
 * seam in the current text color so the two halves read as separate targets.
 */
export const splitStart = "rounded-r-none touch:rounded-r-none";
export const splitEnd =
  "rounded-l-none border-l border-[color-mix(in_srgb,currentColor_24%,transparent)] touch:rounded-l-none";
