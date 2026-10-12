import { ContentCard } from "@/components/content/ContentCard";
import { ArticleThumbnail } from "./ArticleThumbnail";
import { articlePath, type ArticleContent } from "@/lib/article-content";
import type { AppLocale } from "@/lib/site-metadata";

export function ArticleCard({
  article,
  locale,
  headingLevel = 2,
}: {
  article: ArticleContent;
  locale: AppLocale;
  headingLevel?: 2 | 3;
}) {
  return (
    <ContentCard
      href={articlePath(locale, article.slug)}
      title={article.title}
      description={article.description}
      category={article.category}
      headingLevel={headingLevel}
      illustration={<ArticleThumbnail article={article} />}
    />
  );
}
