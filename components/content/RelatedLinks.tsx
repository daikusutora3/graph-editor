import { ArrowRight, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { insetFocusRing } from "@/components/ui/styles";

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
    <nav aria-label={label} className={cn("min-w-0", className)}>
      <p className="mb-2 text-xs font-medium text-[var(--muted)]">{title}</p>
      <ul className={cn("grid gap-2", links.length > 1 && "sm:grid-cols-2")}>
        {links.map((link) => (
          <li key={link.href} className="min-w-0">
            <a
              href={link.href}
              className={cn(
                "group/related flex h-full min-h-12 items-center gap-3 rounded-xl bg-[var(--fill)] px-4 py-3 text-sm leading-6 text-[var(--text-2)] transition-colors hover:bg-[var(--panel-solid)] hover:text-[var(--text)] motion-reduce:transition-none",
                insetFocusRing,
              )}
            >
              <BookOpen
                className="size-4 shrink-0 text-[var(--muted)]"
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 font-medium">{link.title}</span>
              <ArrowRight
                className="size-4 shrink-0 text-[var(--muted)]"
                aria-hidden="true"
              />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
