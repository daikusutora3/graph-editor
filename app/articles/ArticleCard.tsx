import Link from "next/link";
import { ArticleThumbnail } from "./ArticleThumbnail";
import { focusRing } from "@/components/ui/styles";
import { articlePath, type ArticleContent } from "@/lib/article-content";
import type { AppLocale } from "@/lib/site-metadata";
import { cn } from "@/lib/utils";

export function ArticleCard({
  article,
  locale,
}: {
  article: ArticleContent;
  locale: AppLocale;
}) {
  return (
    <Link
      href={articlePath(locale, article.slug)}
      prefetch={false}
      className={cn(
        "group flex min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel-solid)] text-[var(--text)] transition-colors duration-150 hover:bg-[var(--fill)] active:opacity-90 motion-reduce:transition-none",
        focusRing,
      )}
    >
      <div className="relative flex min-h-44 items-center justify-center border-b border-[var(--line)] bg-[var(--fill)] px-5 py-3">
        <ArticleThumbnail article={article} />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[var(--text)] opacity-0 transition-opacity duration-150 group-hover:opacity-5 motion-reduce:transition-none"
        />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[13px] font-medium text-[var(--muted)]">
          {article.category}
        </p>
        <h2 className="mt-2 text-lg leading-7 font-semibold tracking-tight">
          {article.title}
        </h2>
        <p className="mt-3 text-sm leading-7 text-[var(--text-2)]">
          {article.description}
        </p>
      </div>
    </Link>
  );
}
