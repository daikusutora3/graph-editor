import { ArticleThumbnail } from "./ArticleThumbnail";
import type { ArticleContent } from "@/lib/article-content";

export function ArticleCover({ article }: { article: ArticleContent }) {
  return (
    <div
      role="img"
      aria-label={article.title}
      className="mb-6 flex min-w-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--fill)] px-6 py-4 sm:mb-8 sm:py-6"
    >
      <div className="w-full max-w-md">
        <ArticleThumbnail article={article} />
      </div>
    </div>
  );
}
