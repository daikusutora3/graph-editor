import { ArticleIndexPage } from "@/app/articles/ArticleIndexPage";
import { articleCopy } from "@/lib/article-content";
import { createArticleIndexMetadata } from "@/lib/site-metadata";

export const metadata = createArticleIndexMetadata("ja", articleCopy.ja);

export default function JapaneseArticles() {
  return <ArticleIndexPage locale="ja" />;
}
