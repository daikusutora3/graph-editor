import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./Accordion.module.css";
import { reading } from "./reading";

/** Questions that open one at a time (`name` groups the `<details>`). */
export function Accordion({
  name,
  items,
  className,
}: {
  name: string;
  items: readonly { id: string; title: ReactNode; content: ReactNode }[];
  className?: string;
}) {
  return (
    <div className={cn(reading.rows, className)}>
      {items.map((item) => (
        <details key={item.id} name={name} className={styles.item}>
          <summary
            className={cn(
              styles.summary,
              "flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 text-base leading-7 font-medium text-[var(--text)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--focus)] [&::-webkit-details-marker]:hidden",
            )}
          >
            <span className="min-w-0">{item.title}</span>
            <ChevronDown
              className={cn(
                styles.chevron,
                "size-4 shrink-0 text-[var(--muted)] transition-transform duration-200 ease-out motion-reduce:transition-none",
              )}
              aria-hidden="true"
            />
          </summary>
          <div className={cn("pb-4", reading.body)}>{item.content}</div>
        </details>
      ))}
    </div>
  );
}
