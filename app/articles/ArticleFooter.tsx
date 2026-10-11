import { ArrowRight, ArrowUp } from "lucide-react";
import Link from "next/link";
import { ContextGuideLink } from "@/components/content/ContextGuideLink";
import { actionStyles } from "@/components/ui/styles";
import { articleCopy, articleIndexPath } from "@/lib/article-content";
import { APP_NAME, type AppLocale } from "@/lib/site-metadata";
import { cn } from "@/lib/utils";

export function ArticleFooter({ locale }: { locale: AppLocale }) {
  const copy = articleCopy[locale];
  return (
    <footer className="border-t border-[var(--line)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-8">
        <p
          className="text-[13px] font-medium text-[var(--muted)]"
          translate="no"
        >
          {APP_NAME} <span className="font-normal">by daikusutora3</span>
        </p>
        <nav
          aria-label={copy.articlesLink}
          className="flex flex-wrap items-center gap-1"
        >
          <ContextGuideLink
            locale={locale}
            target="guide-start"
            label={copy.guideLink}
          />
          <Link
            href={articleIndexPath(locale)}
            prefetch={false}
            className={cn(actionStyles(), "text-sm active:bg-[var(--fill-2)]")}
          >
            {copy.allArticles}
            <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
          </Link>
          <a
            href="#articles-top"
            className={cn(actionStyles(), "text-sm active:bg-[var(--fill-2)]")}
          >
            {copy.backToTop}
            <ArrowUp className="size-4 shrink-0" aria-hidden="true" />
          </a>
        </nav>
      </div>
    </footer>
  );
}
