import { ArrowRight, ChevronRight } from "lucide-react";
import Link from "next/link";
import { ContentExample } from "@/components/content/ContentExample";
import {
  ReadingPage,
  ReadingContainer,
  ReadingIntro,
  ReadingBody,
} from "@/components/content/ReadingLayout";
import { ArticleCover } from "./ArticleCover";
import { ContentCardGrid } from "@/components/content/ContentCard";
import { ActionLink } from "@/components/ui/ActionLink";
import { ArticleCard } from "./ArticleCard";
import { ArticleDiagram } from "./ArticleDiagram";
import {
  ArticleScreenshot,
  articleScreenshotSections,
} from "./ArticleScreenshot";
import { ContentFooter } from "@/components/content/ContentFooter";
import { ContextGuideLink } from "@/components/content/ContextGuideLink";
import { ContentSection } from "@/components/ui/ContentSection";
import { actionStyles, bodyText, readingMeasure } from "@/components/ui/styles";
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
    <ReadingPage
      locale={locale}
      section="articles"
      slug={article.slug}
      topId="articles-top"
      contentId="article-content"
      skipLabel={copy.skipToContent}
      structuredData={structuredData}
    >
      <ReadingContainer>
        <ArticleCover article={article} />
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
        <ReadingIntro title={article.title} description={article.introduction}>
          <div className="mt-4 flex min-w-0 flex-wrap items-center gap-x-3 text-sm">
            <span className="text-xs text-[var(--muted)]">
              {copy.operationGuideLabel}
            </span>
            <ContextGuideLink
              locale={locale}
              target={article.guide.sectionId}
              label={article.guide.label}
            />
          </div>
        </ReadingIntro>
        <ReadingBody id="article-content" locale={locale} entries={entries}>
          <div className="space-y-10 sm:space-y-14">
            {article.sections.map((section) => (
              <ContentSection
                key={section.id}
                id={section.id}
                title={section.title}
                variant="plain"
              >
                {section.id === articleScreenshotSections[article.slug] ? (
                  <ArticleScreenshot slug={article.slug} locale={locale} />
                ) : null}
                <div className={cn("mt-4 space-y-5", bodyText, readingMeasure)}>
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
              variant="plain"
            >
              <ContentExample
                input={article.example.input}
                title={article.title}
                labels={copy}
                caption={article.example.result}
              >
                <ArticleDiagram example={article.example} />
              </ContentExample>
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
              variant="plain"
            >
              <ContentCardGrid className="mt-5" columns={2}>
                {related.map((relatedArticle) => (
                  <ArticleCard
                    key={relatedArticle.slug}
                    article={relatedArticle}
                    locale={locale}
                    headingLevel={3}
                  />
                ))}
              </ContentCardGrid>
              <ActionLink
                href={articleIndexPath(locale)}
                className={cn(
                  actionStyles(),
                  "mt-4 -ml-3 text-sm active:bg-[var(--fill-2)]",
                )}
              >
                {copy.allArticles}
                <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
              </ActionLink>
            </ContentSection>
          </div>
          <ContentFooter locale={locale} topId="articles-top" />
        </ReadingBody>
      </ReadingContainer>
    </ReadingPage>
  );
}
