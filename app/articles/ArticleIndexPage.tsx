import { ContentCardGrid } from "@/components/content/ContentCard";
import { ArticleCard } from "./ArticleCard";
import { ContentFooter } from "@/components/content/ContentFooter";
import {
  ReadingPage,
  ReadingContainer,
  ReadingIntro,
} from "@/components/content/ReadingLayout";
import { articleCopy, articlePath, getArticles } from "@/lib/article-content";
import { getAppPathUrl, type AppLocale } from "@/lib/site-metadata";

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
    <ReadingPage
      locale={locale}
      section="articles"
      topId="articles-top"
      contentId="articles-content"
      skipLabel={copy.skipToContent}
      structuredData={structuredData}
    >
      <ReadingContainer>
        <ReadingIntro title={copy.heading} description={copy.indexIntro} />
        <ContentCardGrid id="articles-content" tabIndex={-1} className="mt-8">
          {articles.map((article) => (
            <ArticleCard key={article.slug} article={article} locale={locale} />
          ))}
        </ContentCardGrid>
        <ContentFooter locale={locale} topId="articles-top" />
      </ReadingContainer>
    </ReadingPage>
  );
}
