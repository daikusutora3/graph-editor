import { ArrowUp } from "lucide-react";
import { actionStyles } from "@/components/ui/styles";
import { BrandLogo } from "@/features/graph-editor/ui/brand/BrandLogo";
import { articleCopy } from "@/lib/article-content";
import { APP_NAME, type AppLocale } from "@/lib/site-metadata";
import { cn } from "@/lib/utils";

export function ArticleFooter({ locale }: { locale: AppLocale }) {
  const copy = articleCopy[locale];
  return (
    <footer className="border-t border-[var(--line)] bg-[var(--panel-solid)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-[var(--reading-gutter)] py-7 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-x-8 md:py-8">
        <div className="flex min-w-0 items-center gap-3" translate="no">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--fill)]">
            <BrandLogo size={28} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-[var(--text)]">
              {APP_NAME}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">by daikusutora3</p>
          </div>
        </div>
        <a
          href="#articles-top"
          className={cn(
            actionStyles("soft"),
            "self-start text-sm md:self-auto",
          )}
        >
          <ArrowUp className="size-4 shrink-0" aria-hidden="true" />
          {copy.backToTop}
        </a>
      </div>
    </footer>
  );
}
