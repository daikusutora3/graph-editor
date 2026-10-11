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
    >
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {copy.quickStartCards.map((card) => (
          <Card key={card.id} className="flex flex-col">
            <div className="mb-3 flex items-center gap-3 md:flex-col md:items-start">
              <div className="h-14 w-16 shrink-0 text-[var(--text-2)] sm:h-16 sm:w-28 md:h-20 md:w-full">
                <EmptyStateIllustration
                  method={card.id === "data" ? "paste" : card.id}
                  tone="neutral"
                />
              </div>
              <h3 className="text-sm leading-6 font-semibold">{card.title}</h3>
            </div>
            <p className="text-[13px] leading-6 text-[var(--text-2)]">
              {card.description}
            </p>
            <ol className="mt-3 flex-1 list-decimal space-y-1 pl-4 text-[13px] leading-6 text-[var(--text-2)] marker:text-[var(--muted)]">
              {card.steps.map((step) => (
                <li key={step} className="pl-1">
                  {step}
                </li>
              ))}
            </ol>
            <ActionLink
              href={`#guide-${card.targetId}`}
              variant="soft"
              className="mt-4 justify-between text-xs"
            >
              {card.id === "data" ? copy.examplesLink : copy.quickStartAction}
              <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
            </ActionLink>
          </Card>
        ))}
      </div>
    </ContentSection>
  );
}
