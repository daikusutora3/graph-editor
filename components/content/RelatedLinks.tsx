import { cn } from "@/lib/utils";
import { reading } from "./reading";

/** A single quiet line of related links: "Related  Title · Title". */
export function RelatedLinks({
  title,
  label = title,
  links,
  className,
}: {
  title: string;
  label?: string;
  links: readonly { href: string; title: string }[];
  className?: string;
}) {
  if (links.length === 0) return null;

  return (
    <nav
      aria-label={label}
      className={cn(
        "flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 text-sm",
        className,
      )}
    >
      <span className="text-[var(--muted)]">{title}</span>
      <ul className="contents">
        {links.map((link, index) => (
          <li key={link.href} className="inline-flex items-baseline gap-2">
            {index > 0 ? (
              <span aria-hidden="true" className="text-[var(--disabled)]">
                ·
              </span>
            ) : null}
            <a href={link.href} className={reading.link}>
              {link.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
