import { Disclosure } from "@/components/ui/Disclosure";
import { guideVisualCopy } from "@/lib/guide-visual-content";
import { ContentCard, ContentCardGrid } from "@/components/content/ContentCard";
import { ContentSection } from "@/components/ui/ContentSection";
import { EmptyStateIllustration } from "@/features/graph-editor/ui/chrome/EmptyStateIllustration";
import { guideCopy } from "@/lib/guide-content";
import type { AppLocale } from "@/lib/site-metadata";

export function GuideQuickStart({ locale }: { locale: AppLocale }) {
  const copy = guideCopy[locale];
  return (
    <ContentSection
      id="guide-start"
      title={copy.quickStartTitle}
      description={copy.quickStartIntro}
      variant="plain"
      className="@container/guide-start"
    >
      <ContentCardGrid className="mt-5">
        {copy.quickStartCards.map((card) => (
          <ContentCard
            key={card.id}
            href={`#guide-${card.targetId}`}
            title={card.title}
            description={card.description}
            actionLabel={
              card.id === "data" ? copy.examplesLink : copy.quickStartAction
            }
            illustration={
              <EmptyStateIllustration
                method={card.id === "data" ? "paste" : card.id}
                tone="neutral"
              />
            }
          />
        ))}
      </ContentCardGrid>
      <Disclosure
        variant="compact"
        title={guideVisualCopy[locale].details}
        className="mt-3"
      >
        <div className="grid gap-6">
          {copy.quickStartCards.map((card) => (
            <div key={card.id} className="min-w-0">
              <h3 className="mb-2 font-medium text-[var(--text)]">
                {card.title}
              </h3>
              <ol className="list-decimal space-y-2 pl-4">
                {card.steps.map((step) => (
                  <li key={step} className="pl-1">
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </Disclosure>
    </ContentSection>
  );
}
