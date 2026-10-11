import { Disclosure } from "@/components/ui/Disclosure";
import { guideVisualCopy } from "@/lib/guide-visual-content";
import { ArrowRight } from "lucide-react";
import { ActionLink } from "@/components/ui/ActionLink";
import { Card } from "@/components/ui/Card";
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
      <div className="mt-5 grid grid-cols-1 gap-3 @min-[40rem]/guide-start:grid-cols-3">
        {copy.quickStartCards.map((card) => (
          <Card key={card.id} className="flex flex-col">
            <div className="mb-3 flex items-center gap-3 @min-[40rem]/guide-start:flex-col @min-[40rem]/guide-start:items-start">
              <div className="h-20 w-24 shrink-0 text-[var(--text-2)] @min-[40rem]/guide-start:h-36 @min-[40rem]/guide-start:w-full">
                <EmptyStateIllustration
                  method={card.id === "data" ? "paste" : card.id}
                  tone="neutral"
                />
              </div>
              <h3 className="text-base leading-7 font-semibold">
                {card.title}
              </h3>
            </div>
            <p className="flex-1 text-sm leading-7 text-[var(--text-2)]">
              {card.description}
            </p>
            <ActionLink
              href={`#guide-${card.targetId}`}
              variant="soft"
              className="mt-4 justify-between text-sm"
            >
              {card.id === "data" ? copy.examplesLink : copy.quickStartAction}
              <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
            </ActionLink>
          </Card>
        ))}
      </div>
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
