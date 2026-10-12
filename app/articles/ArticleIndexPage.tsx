import readingStyles from "@/components/content/ReadingLayout.module.css";
import { ArticleCard } from "./ArticleCard";
import { ContentFooter } from "@/components/content/ContentFooter";
import {
  ReadingContainer,
  ReadingIntro,
} from "@/components/content/ReadingLayout";
import { ContentHeader } from "@/components/content/ContentNavigation";
import { focusRing } from "@/components/ui/styles";
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
      className={cn(
        "min-h-dvh bg-[var(--bg)] [overflow-wrap:anywhere] text-[var(--text)]",
        readingStyles.page,
      )}
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
      <ReadingContainer>
        <ReadingIntro title={copy.heading} description={copy.indexIntro} />
        <div
          id="articles-content"
          tabIndex={-1}
          className="mt-8 grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-5"
        >
          {articles.map((article) => (
            <ArticleCard key={article.slug} article={article} locale={locale} />
          ))}
        </div>
        <ContentFooter locale={locale} topId="articles-top" />
      </ReadingContainer>
    </main>
  );
}
