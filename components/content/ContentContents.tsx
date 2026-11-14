import { focusRing } from "@/components/ui/styles";
import { cn } from "@/lib/utils";
import styles from "./ReadingLayout.module.css";

type ContentsEntry = { href: string; title: string };

/** Table of contents as a plain list of text links (sticky beside the text on wide screens). */
export function ContentContents({
  title,
  entries,
}: {
  title: string;
  entries: readonly ContentsEntry[];
}) {
  return (
    <aside className={cn("mb-8 min-w-0 lg:mb-0", styles.contents)}>
      <nav aria-label={title}>
        <p className="mb-2 text-xs font-semibold text-[var(--muted)]">
          {title}
        </p>
        <ol
          className={cn("-mx-2 grid grid-cols-1 gap-x-4", styles.contentsList)}
        >
          {entries.map((entry) => (
            <li key={entry.href} className="min-w-0">
              <a
                href={entry.href}
                className={cn(
                  focusRing,
                  "block min-h-9 rounded-md px-2 py-1.5 text-sm leading-6 [overflow-wrap:anywhere] text-[var(--text-2)] transition-colors hover:bg-[var(--fill)] hover:text-[var(--text)]",
                )}
              >
                {entry.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </aside>
  );
}
