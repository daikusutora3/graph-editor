import Link from "next/link";
import type { ReactNode } from "react";
import { focusRing } from "@/components/ui/control-styles";
import { cn } from "@/lib/utils";
import { reading } from "./reading";

export type LinkListItem = {
  href: string;
  title: string;
  description?: string;
  /** A short line above the title (an article's category). */
  meta?: string;
  /** A small picture beside the text. */
  figure?: ReactNode;
};

/**
 * A list of pages or sections, one row each, separated by hairlines. Used for
 * the guide's starting points, the article index, and related articles.
 */
export function LinkList({
  items,
  headingLevel,
  className,
}: {
  items: readonly LinkListItem[];
  /** Render titles as headings when the list is the page's main content. */
  headingLevel?: 2 | 3;
  className?: string;
}) {
  const Title = headingLevel ? (`h${headingLevel}` as const) : "span";
  return (
    <ul className={cn("max-w-3xl", reading.rows, className)}>
      {items.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            prefetch={false}
            className={cn(
              focusRing,
              "group flex min-h-12 items-center gap-4 rounded-sm py-3 sm:gap-5",
            )}
          >
            {item.figure ? (
              <span className="w-20 shrink-0 text-[var(--text-2)] sm:w-40">
                {item.figure}
              </span>
            ) : null}
            <span className="min-w-0">
              {item.meta ? (
                <span className="block text-xs leading-5 text-[var(--muted)]">
                  {item.meta}
                </span>
              ) : null}
              <Title className="block text-base leading-7 font-semibold text-[var(--text)] underline-offset-4 group-hover:underline">
                {item.title}
              </Title>
              {item.description ? (
                <span className={cn("block", reading.caption)}>
                  {item.description}
                </span>
              ) : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
