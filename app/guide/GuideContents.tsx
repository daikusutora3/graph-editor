import {
  ArrowDown,
  BookOpen,
  CircleHelp,
  Download,
  FileInput,
  Hand,
  Keyboard,
  LayoutGrid,
  MousePointer2,
  Palette,
  Play,
  type LucideIcon,
} from "lucide-react";
import { focusRing } from "@/components/ui/styles";
import { cn } from "@/lib/utils";
import styles from "./GuideLayout.module.css";

type ContentsEntry = { href: string; title: string };

const topicIcons: Record<string, LucideIcon> = {
  "#guide-start": Play,
  "#guide-examples": BookOpen,
  "#guide-import": FileInput,
  "#guide-draw": MousePointer2,
  "#guide-appearance": Palette,
  "#guide-layouts": LayoutGrid,
  "#guide-export": Download,
  "#guide-shortcuts": Keyboard,
  "#guide-touch": Hand,
  "#guide-faq": CircleHelp,
};

export function GuideContents({
  title,
  entries,
}: {
  title: string;
  entries: readonly ContentsEntry[];
}) {
  return (
    <aside className={cn("mb-8 min-w-0 lg:mb-0", styles.contents)}>
      <nav aria-label={title}>
        <p className="mb-3 text-xs font-semibold text-[var(--muted)]">
          {title}
        </p>
        <ol className={cn("grid grid-cols-1 gap-2", styles.contentsList)}>
          {entries.map((entry) => {
            const Icon = topicIcons[entry.href] ?? BookOpen;
            return (
              <li key={entry.href} className="min-w-0">
                <a
                  href={entry.href}
                  className={cn(
                    focusRing,
                    "group flex h-full min-h-12 w-full min-w-0 items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel-solid)] px-3 py-2.5 text-sm leading-5 text-[var(--text-2)] transition-colors hover:border-[var(--muted)] hover:bg-[var(--fill)] hover:text-[var(--text)] active:bg-[var(--fill-2)] lg:gap-2 lg:rounded-lg lg:px-2.5",
                  )}
                >
                  <Icon
                    className="size-4 shrink-0 text-[var(--muted)] group-hover:text-[var(--text)]"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 font-medium [overflow-wrap:anywhere]">
                    {entry.title}
                  </span>
                  <ArrowDown
                    className={cn(
                      "size-3.5 shrink-0 text-[var(--muted)] group-hover:text-[var(--text)] lg:hidden",
                      styles.contentsArrow,
                    )}
                    aria-hidden="true"
                  />
                </a>
              </li>
            );
          })}
        </ol>
      </nav>
    </aside>
  );
}
