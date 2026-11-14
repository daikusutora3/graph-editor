import Link from "next/link";
import { ContentCopyButton } from "@/components/content/ContentCopyButton";
import { ContentExample } from "@/components/content/ContentExample";
import { ContentFooter } from "@/components/content/ContentFooter";
import {
  ContentSection,
  InlineText,
} from "@/components/content/ContentSection";
import { LinkList } from "@/components/content/LinkList";
import {
  ReadingPage,
  ReadingContainer,
  ReadingIntro,
  ReadingBody,
} from "@/components/content/ReadingLayout";
import { RelatedLinks } from "@/components/content/RelatedLinks";
import { TextLink } from "@/components/content/TextLink";
import { reading } from "@/components/content/reading";
import { focusRing } from "@/components/ui/control-styles";
import { ArticleDiagram } from "./ArticleDiagram";
import { ArticleThumbnail } from "./ArticleThumbnail";
import {
  ArticleScreenshot,
  articleScreenshotSections,
} from "./ArticleScreenshot";
import {
  articleCopy,
  articleIndexPath,
  articlePath,
  getArticle,
  type ArticleContent,
  type ArticleSample,
} from "@/lib/article-content";
import {
  APP_NAME,
  appAuthorStructuredData,
  appGuidePaths,
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
        <ReadingIntro
          title={article.title}
          description={article.introduction}
          before={
            <nav
              aria-label={copy.articlesLink}
              className="mb-3 flex flex-wrap items-center gap-x-2 text-sm text-[var(--muted)]"
            >
              <Link
                href={articleIndexPath(locale)}
                prefetch={false}
                className={cn(
                  focusRing,
                  "inline-flex min-h-11 items-center rounded-sm hover:text-[var(--text)] sm:min-h-0",
                )}
              >
                {copy.articlesLink}
              </Link>
              <span aria-hidden="true" className="text-[var(--disabled)]">
                /
              </span>
              <span>{article.category}</span>
            </nav>
          }
        >
          <RelatedLinks
            title={copy.operationGuideLabel}
            className="mt-4"
            links={[
              {
                href: `${appGuidePaths[locale]}#${article.guide.sectionId}`,
                title: article.guide.label,
              },
            ]}
          />
        </ReadingIntro>
        <ReadingBody id="article-content" locale={locale} entries={entries}>
          <div className="space-y-10 sm:space-y-14">
            {article.sections.map((section) => (
              <ContentSection
                key={section.id}
                id={section.id}
                title={section.title}
              >
                {section.id === articleScreenshotSections[article.slug] ? (
                  <ArticleScreenshot slug={article.slug} locale={locale} />
                ) : null}
                <div className={cn("mt-4 space-y-5", reading.body)}>
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>
                      <InlineText text={paragraph} />
                    </p>
                  ))}
                  {section.samples?.length ? (
                    <ArticleSamples
                      samples={section.samples}
                      labels={{ ...copy, copy: copy.copySample }}
                    />
                  ) : null}
                  {section.points?.length ? (
                    <ul className={reading.list}>
                      {section.points.map((point) => (
                        <li key={point}>
                          <InlineText text={point} />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </ContentSection>
            ))}
            <ContentSection id="article-example" title={copy.exampleTitle}>
              <ContentExample
                input={article.example.input}
                title={article.title}
                labels={copy}
                caption={article.example.result}
              >
                <ArticleDiagram example={article.example} />
              </ContentExample>
              <p className="mt-2">
                <TextLink
                  href={`${appGuidePaths[locale]}#${article.example.guideExampleId}`}
                  arrow
                >
                  {copy.sameExampleGuideLabel}
                </TextLink>
              </p>
            </ContentSection>
            <ContentSection
              id="article-related"
              title={copy.relatedTitle}
              className="max-w-3xl"
              action={
                <TextLink href={articleIndexPath(locale)} arrow>
                  {copy.allArticles}
                </TextLink>
              }
            >
              <LinkList
                className="mt-3"
                items={related.map((relatedArticle) => ({
                  href: articlePath(locale, relatedArticle.slug),
                  title: relatedArticle.title,
                  description: relatedArticle.description,
                  meta: relatedArticle.category,
                  figure: <ArticleThumbnail article={relatedArticle} />,
                }))}
              />
            </ContentSection>
          </div>
          <ContentFooter locale={locale} topId="articles-top" />
        </ReadingBody>
      </ReadingContainer>
    </ReadingPage>
  );
}

/** Inputs or code snippets, each with a title, an optional note, and a copy button. */
function ArticleSamples({
  samples,
  labels,
}: {
  samples: readonly ArticleSample[];
  labels: { copy: string; copySuccess: string; copyFailure: string };
}) {
  return (
    <div className="space-y-5">
      {samples.map((sample) => (
        <div key={sample.title} className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-x-3">
            <h3 className="text-sm leading-6 font-semibold text-[var(--text)]">
              {sample.title}
            </h3>
            <ContentCopyButton
              text={sample.code}
              title={sample.title}
              labels={labels}
            />
          </div>
          {sample.note ? (
            <p className={reading.caption}>{sample.note}</p>
          ) : null}
          <pre className={cn("mt-2", reading.code)} translate="no">
            <code>{sample.code}</code>
          </pre>
        </div>
      ))}
    </div>
  );
}
