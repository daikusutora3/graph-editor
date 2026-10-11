import { ArrowRight, BookOpen } from "lucide-react";
import { GuideExamples } from "./GuideExamples";
import { GuideFooter } from "./GuideFooter";
import {
  GuideContents,
  GuideHeader,
  GuideLanguageSwitcher,
} from "./GuideNavigation";
import { GuideQuickStart } from "./GuideQuickStart";
import { GuideSectionContent } from "./GuideSectionContent";
import { GuideStickyHeader } from "./GuideStickyHeader";
import styles from "./GuideLayout.module.css";
import { ReadingReturnLink } from "@/components/content/ReadingReturnLink";
import { ActionLink } from "@/components/ui/ActionLink";
import { Accordion } from "@/components/ui/Accordion";
import { Callout } from "@/components/ui/Callout";
import { ContentSection } from "@/components/ui/ContentSection";
import { focusRing } from "@/components/ui/styles";
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
        styles.page,
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
      <GuideStickyHeader>
        <GuideHeader locale={locale} />
        <ReadingReturnLink locale={locale} />
      </GuideStickyHeader>
      <div className="mx-auto max-w-6xl px-4 pt-8 pb-12 sm:px-8 sm:pt-12 sm:pb-16">
        <header className="mb-8 sm:mb-10">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <p className="inline-flex items-center gap-2.5 text-[13px] font-semibold text-[var(--text-2)]">
              <BookOpen
                className="size-4 shrink-0 text-[var(--muted)]"
                aria-hidden="true"
              />
              {copy.guideLink}
            </p>
            <GuideLanguageSwitcher locale={locale} />
          </div>
          <h1 className="mt-4 max-w-3xl text-[26px] leading-tight font-semibold tracking-tight text-balance sm:text-4xl sm:leading-tight">
            {copy.heading}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--text-2)]">
            {copy.intro}
          </p>
        </header>
        <div className="min-w-0 lg:grid lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-12">
          <GuideContents title={copy.onThisPage} entries={entries} />
          <article
            id="guide-content"
            tabIndex={-1}
            className="min-w-0 scroll-mt-36 sm:scroll-mt-28"
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
                >
                  <GuideSectionContent section={section} />
                  {section.id === "shortcuts" ? (
                    <p className="mt-4 text-xs leading-6 text-[var(--muted)]">
                      {copy.shortcutsNote}
                    </p>
                  ) : null}
                  {section.note ? (
                    <Callout title={section.note.title} className="mt-5">
                      <p>{section.note.text}</p>
                    </Callout>
                  ) : null}
                  {getArticlesForGuideSection(locale, section.id).length > 0 ? (
                    <nav
                      aria-label={`${section.navTitle}: ${articleCopy[locale].relatedTitle}`}
                      className="mt-5 border-t border-[var(--hair)] pt-3"
                    >
                      <p className="mb-1 text-sm font-medium text-[var(--muted)]">
                        {articleCopy[locale].relatedTitle}
                      </p>
                      <div className="flex flex-col items-start gap-1">
                        {getArticlesForGuideSection(locale, section.id).map(
                          (article) => (
                            <ActionLink
                              key={article.slug}
                              href={articlePath(locale, article.slug)}
                              className="text-sm"
                            >
                              {article.title}
                              <ArrowRight
                                className="size-4 shrink-0"
                                aria-hidden="true"
                              />
                            </ActionLink>
                          ),
                        )}
                      </div>
                    </nav>
                  ) : null}
                </ContentSection>
              ))}
            </div>
            <ContentSection
              id="guide-faq"
              title={copy.faqTitle}
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
