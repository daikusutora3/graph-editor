import { ArticleCard } from "./ArticleCard";
import { ArticleFooter } from "./ArticleFooter";
import { ContentHeader } from "@/components/content/ContentNavigation";
import { bodyText, readingMeasure, focusRing } from "@/components/ui/styles";
import { articleCopy, articlePath, getArticles } from "@/lib/article-content";
import { getAppPathUrl, type AppLocale } from "@/lib/site-metadata";
import { cn } from "@/lib/utils";

export function ArticleIndexPage({ locale }: { locale: AppLocale }) {
  const copy = articleCopy[locale];
  const articles = getArticles(locale);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: copy.heading,
    itemListElement: articles.map((article, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: article.title,
      url: getAppPathUrl(articlePath(locale, article.slug)),
    })),
  };

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
        href="#articles-content"
        className={cn(
          "sr-only fixed top-3 left-3 z-50 rounded-lg bg-[var(--panel-solid)] px-4 py-3 text-sm focus:not-sr-only",
          focusRing,
        )}
      >
        {copy.skipToContent}
      </a>
      <ContentHeader locale={locale} section="articles" />
      <div className="mx-auto max-w-6xl px-4 pt-8 pb-12 sm:px-8 sm:pt-12 sm:pb-16">
        <header>
          <h1 className="max-w-3xl text-[28px] leading-tight font-semibold tracking-tight text-balance sm:text-4xl sm:leading-tight">
            {copy.heading}
          </h1>
          <p className={cn("mt-4", bodyText, readingMeasure)}>
            {copy.indexIntro}
          </p>
        </header>
        <div
          id="articles-content"
          tabIndex={-1}
          className="mt-8 grid min-w-0 scroll-mt-28 gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {articles.map((article) => (
            <ArticleCard key={article.slug} article={article} locale={locale} />
          ))}
        </div>
      </div>
      <ArticleFooter locale={locale} />
    </main>
  );
}
