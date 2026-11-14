import { cn } from "@/lib/utils";
import { focusRing } from "./control-styles";
import { surface } from "./surfaces";

export { focusRing };
export const insetFocusRing =
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--focus)]";
export const panelSurface = cn("min-w-0", surface.card);

export const bodyText =
  "text-base leading-[1.85] text-[var(--text-2)] [overflow-wrap:break-word] sm:text-[17px]";
export const figureCaption = "text-sm leading-7 text-[var(--text-2)]";
export const readingMeasure = "max-w-[42rem]";

export const actionStyles = cn(
  "inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 transition-colors",
  focusRing,
  "font-medium text-[var(--text-2)] hover:text-[var(--text)] active:opacity-80",
);
