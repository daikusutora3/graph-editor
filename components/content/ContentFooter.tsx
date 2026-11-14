import { ArrowUp, ExternalLink } from "lucide-react";
import { reading } from "./reading";
import { guideCopy } from "@/lib/guide-content";
import { REPOSITORY_URL, type AppLocale } from "@/lib/site-metadata";

/** One quiet line: the site and author on the left, two links on the right. */
export function ContentFooter({
  locale,
  topId,
}: {
  locale: AppLocale;
  topId: string;
}) {
  const copy = guideCopy[locale];
  return (
    <footer className="mt-12 flex flex-wrap items-center justify-between gap-x-6 border-t border-[var(--hair)] pt-3 sm:mt-16">
      <p className="py-2 text-sm text-[var(--muted)]" translate="no">
        <span className="font-medium text-[var(--text-2)]">Graph Editor</span>{" "}
        by daikusutora3
      </p>
      <div className="flex flex-wrap items-center gap-x-5">
        <a href={`#${topId}`} className={reading.quietLink}>
          <ArrowUp className="size-3.5 shrink-0" aria-hidden="true" />
          {copy.backToTop}
        </a>
        <a
          href={REPOSITORY_URL}
          rel="noreferrer"
          aria-label={copy.githubLink}
          className={reading.quietLink}
        >
          <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
          GitHub
        </a>
      </div>
    </footer>
  );
}
