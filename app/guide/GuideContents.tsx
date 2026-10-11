import { actionStyles } from "@/components/ui/styles";
import { cn } from "@/lib/utils";
import styles from "./GuideLayout.module.css";

type ContentsEntry = { href: string; title: string };

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
        <p className="mb-3 px-3 text-xs font-semibold text-[var(--muted)]">
          {title}
        </p>
        <ol
          className={cn(
            "grid gap-x-2 border-l border-[var(--line)] pl-2 sm:grid-cols-2 lg:grid-cols-1",
            styles.contentsList,
          )}
        >
          {entries.map((entry) => (
            <li key={entry.href}>
              <a
                href={entry.href}
                className={cn(actionStyles(), "w-full text-sm leading-6")}
              >
                {entry.title}
              </a>
            </li>
          ))}
        </ol>
        <p
          translate="no"
          className="mt-6 hidden px-3 text-xs text-[var(--muted)] lg:block"
        >
          by daikusutora3
        </p>
      </nav>
    </aside>
  );
}
