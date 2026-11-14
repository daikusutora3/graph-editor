import { ContentSection } from "@/components/content/ContentSection";
import { LinkList } from "@/components/content/LinkList";
import { guideCopy } from "@/lib/guide-content";
import type { AppLocale } from "@/lib/site-metadata";

/** The three ways to start, each pointing to the section that explains it. */
export function GuideQuickStart({ locale }: { locale: AppLocale }) {
  const copy = guideCopy[locale];
  return (
    <ContentSection
      id="guide-start"
      title={copy.quickStartTitle}
      description={copy.quickStartIntro}
    >
      <LinkList
        className="mt-4"
        items={copy.quickStartCards.map((card) => ({
          href: `#guide-${card.targetId}`,
          title: card.title,
          description: card.description,
        }))}
      />
    </ContentSection>
  );
}
