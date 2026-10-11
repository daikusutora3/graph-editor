import { cn } from "@/lib/utils";

export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--text-2)]";
export const insetFocusRing =
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--text-2)]";
export const panelSurface =
  "min-w-0 rounded-xl border border-[var(--line)] bg-[var(--panel-solid)]";
export const bodyText = "text-sm leading-7 text-[var(--text-2)]";

const actionVariants = {
  quiet:
    "font-medium text-[var(--text-2)] hover:bg-[var(--fill)] hover:text-[var(--text)]",
  soft: "bg-[var(--fill)] font-medium text-[var(--text)] hover:bg-[var(--fill-2)]",
  primary:
    "bg-[var(--primary)] font-semibold text-[var(--primary-text)] hover:opacity-90",
};

export function actionStyles(variant: keyof typeof actionVariants = "quiet") {
  return cn(
    "inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 transition-colors",
    focusRing,
    actionVariants[variant],
  );
}
