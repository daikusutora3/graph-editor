import readingStyles from "@/components/content/ReadingLayout.module.css";
import { ArrowRight } from "lucide-react";
import { GuideExamples } from "./GuideExamples";
import { GuideFooter } from "./GuideFooter";
import { GuideContents, GuideHeader } from "./GuideNavigation";
import { GuideQuickStart } from "./GuideQuickStart";
import { GuideSectionContent } from "./GuideSectionContent";
import { RelatedLinks } from "@/components/content/RelatedLinks";
import { ActionLink } from "@/components/ui/ActionLink";
import { Accordion } from "@/components/ui/Accordion";
import { ContentSection } from "@/components/ui/ContentSection";
import { bodyText, readingMeasure, focusRing } from "@/components/ui/styles";
import { cn } from "@/lib/utils";
import {
  articleCopy,
  articlePath,
  getArticle,
  getArticlesForGuideSection,
} from "@/lib/article-content";
import {
  GUIDE_LAST_MODIFIED,
  GUIDE_PUBLISHED_DATE,
  toIsoDate,
} from "@/lib/content-dates";
import { guideVisualCopy } from "@/lib/guide-visual-content";
import { guideCopy, guideExampleCopy } from "@/lib/guide-content";
import {
  appAuthorStructuredData,
  appLocaleMetadata,
  getAppGuideUrl,
  getAppLocaleUrl,
  SITE_URL,
  type AppLocale,
} from "@/lib/site-metadata";

const legacySectionIds: Readonly<Record<string, string>> = {
  import: "guide-section-0",
  draw: "guide-section-1",
  layouts: "guide-section-2",
  export: "guide-section-3",
  shortcuts: "guide-section-4",
};

/** The guide renders on the server; copy and return controls use client code. */
export function GuidePage({ locale }: { locale: AppLocale }) {
  const copy = guideCopy[locale];
  const entries = [
    { href: "#guide-start", title: copy.quickStartNavTitle },
    { href: "#guide-examples", title: guideExampleCopy[locale].navTitle },
    ...copy.sections.map((section) => ({
      href: `#guide-${section.id}`,
      title: section.navTitle,
    })),
    { href: "#guide-faq", title: copy.faqTitle },
  ];
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      "@id": `${getAppGuideUrl(locale)}#article`,
      headline: copy.heading,
      description: copy.description,
      url: getAppGuideUrl(locale),
      mainEntityOfPage: getAppGuideUrl(locale),
      inLanguage: locale,
      image: `${SITE_URL}${appLocaleMetadata[locale].ogImage}`,
      datePublished: GUIDE_PUBLISHED_DATE,
      dateModified: toIsoDate(GUIDE_LAST_MODIFIED),
      author: appAuthorStructuredData,
      publisher: appAuthorStructuredData,
      about: { "@id": `${getAppLocaleUrl(locale)}#app` },
      isAccessibleForFree: true,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: copy.faq.map((entry) => ({
        "@type": "Question",
        name: entry.question,
        acceptedAnswer: { "@type": "Answer", text: entry.answer },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: copy.breadcrumbHome,
          item: getAppLocaleUrl(locale),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: copy.heading,
          item: getAppGuideUrl(locale),
        },
      ],
    },
  ];
  return (
    <main
      id="guide-top"
      data-reading
      className={cn(
        "min-h-dvh bg-[var(--bg)] [overflow-wrap:anywhere] text-[var(--text)]",
        readingStyles.page,
      )}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <a
        href="#guide-content"
        className={`sr-only fixed top-3 left-3 z-50 rounded-lg bg-[var(--panel-solid)] px-4 py-3 text-sm focus:not-sr-only ${focusRing}`}
      >
        {copy.skipToContent}
      </a>
      <GuideHeader locale={locale} />
      <div className="mx-auto max-w-6xl px-[var(--reading-gutter)] pt-8 pb-12 sm:pt-12 sm:pb-16">
        <header className="mb-8 sm:mb-10">
          <h1 className="max-w-3xl text-[clamp(1.625rem,1.125rem+2.5vw,2.25rem)] leading-tight font-semibold tracking-tight text-balance">
            {copy.heading}
          </h1>
          <p className={cn("mt-4", bodyText, readingMeasure)}>
            {guideVisualCopy[locale].intro}
          </p>
        </header>
        <div className="min-w-0 lg:grid lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-12">
          <GuideContents title={copy.onThisPage} entries={entries} />
          <article
            id="guide-content"
            tabIndex={-1}
            className="@container/reading min-w-0"
          >
            <GuideQuickStart locale={locale} />
            <GuideExamples locale={locale} />
            <div className="mt-10 space-y-10 sm:mt-14 sm:space-y-14">
              {copy.sections.map((section) => (
                <ContentSection
                  key={section.id}
                  id={`guide-${section.id}`}
                  anchorId={legacySectionIds[section.id]}
                  title={section.title}
                  variant="plain"
                >
                  <GuideSectionContent section={section} locale={locale} />
                  {section.id === "shortcuts" ? (
                    <p className="mt-4 text-xs leading-6 text-[var(--muted)]">
                      {copy.shortcutsNote}
                    </p>
                  ) : null}
                  <RelatedLinks
                    title={articleCopy[locale].relatedTitle}
                    label={`${section.navTitle}: ${articleCopy[locale].relatedTitle}`}
                    className="mt-5"
                    links={getArticlesForGuideSection(locale, section.id).map(
                      (article) => ({
                        href: articlePath(locale, article.slug),
                        title: article.title,
                      }),
                    )}
                  />
                </ContentSection>
              ))}
            </div>
            <ContentSection
              id="guide-faq"
              title={copy.faqTitle}
              variant="plain"
              description={copy.faqIntro}
              className="mt-10 sm:mt-14"
            >
              <Accordion
                name="guide-faq"
                className="mt-5"
                items={copy.faq.map((entry, index) => ({
                  id: entry.question,
                  title: entry.question,
                  content: (
                    <>
                      <p>{entry.answer}</p>
                      {index === 0 ? (
                        <ActionLink
                          href={articlePath(locale, "edge-list")}
                          className="mt-3 text-sm"
                        >
                          {getArticle(locale, "edge-list")!.title}
                          <ArrowRight
                            className="size-4 shrink-0"
                            aria-hidden="true"
                          />
                        </ActionLink>
                      ) : null}
                    </>
                  ),
                }))}
              />
            </ContentSection>
            <GuideFooter locale={locale} />
          </article>
        </div>
      </div>
    </main>
  );
}
