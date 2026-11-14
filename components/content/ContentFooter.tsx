import { ArrowUp, ExternalLink } from "lucide-react";
import { reading } from "./reading";
import { guideCopy } from "@/lib/guide-content";
import { REPOSITORY_URL, type AppLocale } from "@/lib/site-metadata";

export function ContentFooter({
  locale,
  topId,
}: {
  locale: AppLocale;
  topId: string;
}) {
  const copy = guideCopy[locale];
  return (
    <footer className="mt-12 border-t border-[var(--hair)] pt-6 sm:mt-16">
      <div className="flex flex-col gap-3 text-xs text-[var(--muted)] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-6 sm:gap-y-2">
        <p
          className="inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-1"
          translate="no"
        >
          <span className="font-medium text-[var(--text-2)]">Graph Editor</span>
          <span>by daikusutora3</span>
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <a href={`#${topId}`} className={reading.action}>
            {copy.backToTop}
            <ArrowUp className="size-3.5 shrink-0" aria-hidden="true" />
          </a>
          <a href={REPOSITORY_URL} rel="noreferrer" className={reading.action}>
            <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
            {copy.githubLink}
          </a>
        </div>
      </div>
    </footer>
  );
}
