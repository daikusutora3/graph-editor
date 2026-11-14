import { ContentSection } from "@/components/ui/ContentSection";
import { focusRing } from "@/components/ui/styles";
import { guideCopy } from "@/lib/guide-content";
import type { AppLocale } from "@/lib/site-metadata";
import { cn } from "@/lib/utils";

/** The three ways to start, each pointing to the section that explains it. */
export function GuideQuickStart({ locale }: { locale: AppLocale }) {
  const copy = guideCopy[locale];
  return (
    <ContentSection
      id="guide-start"
      title={copy.quickStartTitle}
      description={copy.quickStartIntro}
    >
      <ul className="mt-4 divide-y divide-[var(--hair)] border-y border-[var(--hair)]">
        {copy.quickStartCards.map((card) => (
          <li key={card.id}>
            <a
              href={`#guide-${card.targetId}`}
              className={cn(
                focusRing,
                "group flex min-h-12 flex-wrap items-baseline gap-x-3 gap-y-0.5 py-3 text-sm leading-6 sm:text-base",
              )}
            >
              <span className="font-semibold text-[var(--text)] group-hover:text-[var(--accent-text)]">
                {card.title}
              </span>
              <span className="text-[var(--muted)]">{card.description}</span>
            </a>
          </li>
        ))}
      </ul>
    </ContentSection>
  );
}
