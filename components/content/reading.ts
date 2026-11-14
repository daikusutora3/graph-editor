/**
 * Recipes for the reading pages (guide and articles).
 *
 * The reading pages are plain documents: white page, text, hairline-separated
 * lists, and figures only where they explain something. Pick a recipe by the
 * role of the element. Do not hand-roll type, link, or list styles in page code;
 * add a recipe here (and to docs/design-system.md) instead.
 */
import { cn } from "@/lib/utils";
import { focusRing } from "@/components/ui/control-styles";

export const reading = {
  /** Page title (one `h1` per page). */
  title:
    "max-w-3xl text-[clamp(1.625rem,1.125rem+2.5vw,2.25rem)] leading-tight font-semibold tracking-tight text-balance",
  /** Section heading (`h2`). */
  heading: "text-xl leading-snug font-semibold tracking-tight sm:text-2xl",
  /** Heading inside a section (`h3`). */
  subheading: "text-base leading-7 font-semibold text-[var(--text)]",
  /** Running text, kept to a readable line length. */
  body: "max-w-[42rem] text-base leading-[1.85] text-[var(--text-2)] [overflow-wrap:break-word] sm:text-reading",
  /** Short supporting text: captions, list descriptions, notes under a block. */
  caption: "text-sm leading-6 text-[var(--muted)]",
  /** Small label above a block ("Input", "Contents"). */
  label: "text-sm font-medium text-[var(--muted)]",
  /** Bulleted list inside `body`. */
  list: "list-disc space-y-2 pl-5 marker:text-[var(--muted)]",
  /** Numbered steps inside `body`. */
  steps:
    "list-decimal space-y-3 pl-5 marker:font-semibold marker:text-[var(--muted)]",
  /** Rows separated by hairlines (link lists, shortcut and format tables). */
  rows: "divide-y divide-[var(--hair)] border-y border-[var(--hair)]",
  /** A screenshot or picture on the page. */
  picture: "rounded-xl border border-[var(--line)]",
  /** Text link in running text and link lines. Neutral color, underlined. */
  link: cn(
    focusRing,
    "rounded-sm font-medium text-[var(--text)] underline decoration-[var(--muted)] decoration-1 underline-offset-4 transition-colors hover:decoration-current",
  ),
  /** Quiet button-like link or button in the header, footer, and examples. */
  action: cn(
    focusRing,
    "inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--fill)] hover:text-[var(--text)] active:bg-[var(--fill-2)]",
  ),
} as const;
