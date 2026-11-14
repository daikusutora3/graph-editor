"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { focusRing } from "@/components/ui/control-styles";
import { cn } from "@/lib/utils";
import styles from "./ReadingLayout.module.css";

type ContentsEntry = { href: string; title: string };

/** How far below the top of the viewport a heading counts as "being read". */
const ACTIVE_OFFSET_PX = 120;

/** The entry whose section the reader is in, or null above the first one. */
function useActiveEntry(entries: readonly ContentsEntry[]) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let current: string | null = null;
      for (const entry of entries) {
        const target = document.getElementById(entry.href.slice(1));
        if (target && target.getBoundingClientRect().top <= ACTIVE_OFFSET_PX)
          current = entry.href;
      }
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2;
      if (atBottom && current) current = entries.at(-1)!.href;
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [entries]);
  return active;
}

/**
 * Table of contents. On wide screens it sits beside the text and marks the
 * section being read; on narrow screens it folds into one row that opens the
 * list.
 */
export function ContentContents({
  title,
  entries,
}: {
  title: string;
  entries: readonly ContentsEntry[];
}) {
  const [open, setOpen] = useState(false);
  const active = useActiveEntry(entries);
  const listId = useId();
  return (
    <aside className={cn("mb-8 min-w-0 lg:mb-0", styles.contents)}>
      <nav aria-label={title}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((value) => !value)}
          className={cn(
            focusRing,
            "flex min-h-11 w-full items-center justify-between gap-3 border-y border-[var(--hair)] text-sm font-medium text-[var(--text)] lg:hidden",
          )}
        >
          {title}
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-[var(--muted)] transition-transform motion-reduce:transition-none",
              open && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>
        <p className="mb-2 hidden text-xs font-semibold text-[var(--muted)] lg:block">
          {title}
        </p>
        <ol
          id={listId}
          className={cn(
            "max-lg:mt-2 lg:block",
            open ? "block" : "hidden",
            styles.contentsList,
          )}
        >
          {entries.map((entry) => {
            const current = entry.href === active;
            return (
              <li key={entry.href}>
                <a
                  href={entry.href}
                  aria-current={current ? "location" : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    focusRing,
                    "block border-l-2 py-1.5 pl-3 text-sm leading-6 [overflow-wrap:anywhere] transition-colors max-lg:min-h-11 max-lg:py-2.5",
                    current
                      ? "border-[var(--text)] font-medium text-[var(--text)]"
                      : "border-[var(--hair)] text-[var(--muted)] hover:border-[var(--line)] hover:text-[var(--text)]",
                  )}
                >
                  {entry.title}
                </a>
              </li>
            );
          })}
        </ol>
      </nav>
    </aside>
  );
}
