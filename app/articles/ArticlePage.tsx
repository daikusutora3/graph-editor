import { ArrowRight, BookOpen, ChevronRight } from "lucide-react";
import Link from "next/link";
import { GuideCopyButton } from "@/app/guide/GuideCopyButton";
import { GuideContents } from "@/app/guide/GuideNavigation";
import { ArticleCard } from "./ArticleCard";
import { ArticleDiagram } from "./ArticleDiagram";
import {
  ArticleScreenshot,
  articleScreenshotSections,
} from "./ArticleScreenshot";
import { ArticleFooter } from "./ArticleFooter";
import { ContextGuideLink } from "@/components/content/ContextGuideLink";
import { ContentHeader } from "@/components/content/ContentNavigation";
import { ContentSection } from "@/components/ui/ContentSection";
import {
  actionStyles,
  bodyText,
  readingMeasure,
  focusRing,
} from "@/components/ui/styles";
import {
  articleCopy,
  articleIndexPath,
  getArticle,
  type ArticleContent,
} from "@/lib/article-content";
import {
  APP_NAME,
  appAuthorStructuredData,
  appLocaleMetadata,
  getAppArticleUrl,
  getAppLocaleUrl,
  getAppPathUrl,
  SITE_URL,
  type AppLocale,
} from "@/lib/site-metadata";
import { cn } from "@/lib/utils";
import {
  ARTICLES_PUBLISHED_DATE,
  ARTICLES_LAST_MODIFIED,
  toIsoDate,
} from "@/lib/content-dates";

/** Reading stays on the server; guide context and copying are small client controls. */
export function ArticlePage({
  locale,
  article,
}: {
  locale: AppLocale;
  article: ArticleContent;
}) {
  const copy = articleCopy[locale];
  const entries = [
    ...article.sections.map((section) => ({
      href: `#${section.id}`,
      title: section.title,
    })),
    { href: "#article-example", title: copy.exampleTitle },
    { href: "#article-related", title: copy.relatedTitle },
  ];
  const related = article.relatedSlugs.flatMap((slug) => {
    const relatedArticle = getArticle(locale, slug);
    return relatedArticle ? [relatedArticle] : [];
  });
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      "@id": `${getAppArticleUrl(locale, article.slug)}#article`,
      headline: article.title,
      datePublished: ARTICLES_PUBLISHED_DATE,
      dateModified: toIsoDate(ARTICLES_LAST_MODIFIED),
      description: article.description,
      url: getAppArticleUrl(locale, article.slug),
      mainEntityOfPage: getAppArticleUrl(locale, article.slug),
      inLanguage: locale,
      image: `${SITE_URL}${appLocaleMetadata[locale].ogImage}`,
      author: appAuthorStructuredData,
      publisher: appAuthorStructuredData,
      about: { "@id": `${getAppLocaleUrl(locale)}#app` },
      isAccessibleForFree: true,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: APP_NAME,
          item: getAppLocaleUrl(locale),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: copy.articlesLink,
          item: getAppPathUrl(articleIndexPath(locale)),
        },
        {
          "@type": "ListItem",
          position: 3,
          name: article.title,
          item: getAppArticleUrl(locale, article.slug),
        },
      ],
    },
  ];

  return (
    <main
      id="articles-top"
      data-reading
      className="min-h-dvh bg-[var(--bg)] [overflow-wrap:anywhere] text-[var(--text)]"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <a
        href="#article-content"
        className={cn(
          "sr-only fixed top-3 left-3 z-50 rounded-lg bg-[var(--panel-solid)] px-4 py-3 text-sm focus:not-sr-only",
          focusRing,
        )}
      >
        {copy.skipToContent}
      </a>
      <ContentHeader locale={locale} section="articles" slug={article.slug} />
      <div className="mx-auto max-w-6xl px-4 pt-5 pb-12 sm:px-8 sm:pt-8 sm:pb-16">
        <nav
          aria-label={copy.articlesLink}
          className="mb-5 flex min-w-0 flex-wrap items-center gap-x-1 text-sm text-[var(--muted)]"
        >
          <Link
            href={articleIndexPath(locale)}
            prefetch={false}
            className={cn(actionStyles(), "-ml-3 active:bg-[var(--fill-2)]")}
          >
            {copy.articlesLink}
          </Link>
          <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="py-2">{article.category}</span>
        </nav>
        <header className="mb-7 sm:mb-9">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <p className="text-[13px] font-medium text-[var(--text-2)]">
              {article.category}
            </p>
          </div>
          <h1 className="mt-4 max-w-4xl text-[26px] leading-snug font-semibold tracking-tight text-balance sm:text-4xl sm:leading-tight">
            {article.title}
          </h1>
          <p className={cn("mt-4", bodyText, readingMeasure)}>
            {article.introduction}
          </p>
          <aside className="mt-6 flex min-w-0 items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--fill)] p-4 sm:p-5">
            <BookOpen
              className="mt-1.5 size-5 shrink-0 text-[var(--muted)]"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-[var(--muted)]">
                {copy.operationGuideLabel}
              </p>
              <ContextGuideLink
                locale={locale}
                target={article.guide.sectionId}
                label={article.guide.label}
              />
            </div>
          </aside>
        </header>
        <div className="grid min-w-0 gap-8 lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-12">
          <GuideContents title={copy.onThisPage} entries={entries} />
          <article
            id="article-content"
            tabIndex={-1}
            className={cn(
              readingMeasure,
              "min-w-0 scroll-mt-36 sm:scroll-mt-28",
            )}
          >
            <div className="space-y-10 sm:space-y-12">
              {article.sections.map((section, index) => (
                <ContentSection
                  key={section.id}
                  id={section.id}
                  title={section.title}
                  variant={index === 0 ? "plain" : "divided"}
                  className="scroll-mt-36 sm:scroll-mt-28 [&>h2]:scroll-mt-36 sm:[&>h2]:scroll-mt-28"
                >
                  {section.id === articleScreenshotSections[article.slug] ? (
                    <ArticleScreenshot slug={article.slug} locale={locale} />
                  ) : null}
                  <div className={cn("mt-4 space-y-5", bodyText)}>
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                    {section.points?.length ? (
                      <ul className="list-disc space-y-2 pl-5 marker:text-[var(--muted)]">
                        {section.points.map((point) => (
                          <li key={point}>{point}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </ContentSection>
              ))}
              <ContentSection
                id="article-example"
                title={copy.exampleTitle}
                className="scroll-mt-36 sm:scroll-mt-28 [&>h2]:scroll-mt-36 sm:[&>h2]:scroll-mt-28"
              >
                <div className="mt-5 grid min-w-0 overflow-hidden rounded-xl border border-[var(--line)] sm:grid-cols-2">
                  <div className="min-w-0 bg-[var(--fill)] px-4 pb-5 sm:px-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <p className="text-sm font-medium text-[var(--text-2)]">
                        {copy.input}
                      </p>
                      <GuideCopyButton
                        text={article.example.input}
                        title={article.title}
                        labels={{
                          copy: copy.copy,
                          copySuccess: copy.copySuccess,
                          copyFailure: copy.copyFailure,
                        }}
                      />
                    </div>
                    <pre
                      translate="no"
                      className="min-w-0 overflow-x-auto font-mono text-base leading-7 text-[var(--text)]"
                    >
                      <code>{article.example.input}</code>
                    </pre>
                  </div>
                  <figure className="min-w-0 border-t border-[var(--line)] bg-[var(--panel-solid)] p-4 sm:border-t-0 sm:border-l sm:p-5">
                    <p className="text-sm font-medium text-[var(--text-2)]">
                      {copy.result}
                    </p>
                    <div className="mt-3 flex items-center justify-center">
                      <ArticleDiagram example={article.example} />
                    </div>
                    <figcaption className="mt-3 text-sm leading-7 text-[var(--text-2)]">
                      {article.example.result}
                    </figcaption>
                  </figure>
                </div>
                {article.canonicalGuideExampleId ? (
                  <div className="mt-3">
                    <ContextGuideLink
                      locale={locale}
                      target={article.canonicalGuideExampleId}
                      label={copy.sameExampleGuideLabel}
                    />
                  </div>
                ) : null}
              </ContentSection>
              <ContentSection
                id="article-related"
                title={copy.relatedTitle}
                className="scroll-mt-36 sm:scroll-mt-28 [&>h2]:scroll-mt-36 sm:[&>h2]:scroll-mt-28"
              >
                <div className="mt-5 grid min-w-0 gap-5 sm:grid-cols-2">
                  {related.map((relatedArticle) => (
                    <ArticleCard
                      key={relatedArticle.slug}
                      article={relatedArticle}
                      locale={locale}
                    />
                  ))}
                </div>
                <Link
                  href={articleIndexPath(locale)}
                  prefetch={false}
                  className={cn(
                    actionStyles(),
                    "mt-4 -ml-3 text-sm active:bg-[var(--fill-2)]",
                  )}
                >
                  {copy.allArticles}
                  <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                </Link>
              </ContentSection>
            </div>
          </article>
        </div>
      </div>
      <ArticleFooter locale={locale} />
    </main>
  );
}
