import { cn } from "@/lib/utils";

export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--text-2)]";
export const insetFocusRing =
  "focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-[var(--muted)]";
export const panelSurface =
  "min-w-0 rounded-xl border border-[var(--line)] bg-[var(--panel-solid)]";
export const bodyText = "text-base leading-8 text-[var(--text-2)]";

const actionVariants = {
  quiet:
    "font-medium text-[var(--text-2)] hover:text-[var(--text)] active:opacity-80",
  soft: "bg-[var(--fill)] font-medium text-[var(--text)] hover:opacity-90 active:opacity-80",
  primary:
    "bg-[var(--primary)] font-semibold text-[var(--primary-text)] hover:opacity-90 active:opacity-80",
};

export function actionStyles(variant: keyof typeof actionVariants = "quiet") {
  return cn(
    "inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 transition-colors",
    focusRing,
    actionVariants[variant],
  );
}
