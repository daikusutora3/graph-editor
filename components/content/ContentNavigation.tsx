import { ArrowLeft, BookOpen, Newspaper } from "lucide-react";
import Link from "next/link";
import { BrandLogo } from "@/features/graph-editor/ui/brand/BrandLogo";
import { actionStyles, focusRing } from "@/components/ui/styles";
import { contentNavigationCopy } from "@/lib/content-navigation";
import {
  APP_NAME,
  appArticlePaths,
  appGuidePaths,
  appLocalePaths,
  type AppLocale,
} from "@/lib/site-metadata";
import { cn } from "@/lib/utils";
import { ContentLanguageMenu } from "./ContentLanguageMenu";
import { ContentStickyHeader } from "./ContentStickyHeader";
import { ContentThemeToggle } from "./ContentThemeToggle";
import { ContextGuideLink } from "./ContextGuideLink";

type ReadingSection = "articles" | "guide";
const languages = ["ja", "en", "zh-Hans"] as const;
const languageNames = { ja: "日本語", en: "English", "zh-Hans": "简体中文" };

export function ContentHeader({
  locale,
  section,
  slug,
}: {
  locale: AppLocale;
  section: ReadingSection;
  slug?: string;
}) {
  const copy = contentNavigationCopy[locale];
  const navClass = cn(
    actionStyles(),
    "px-2 text-sm max-[319px]:gap-1 max-[319px]:px-1 max-sm:gap-1.5 max-sm:px-1.5 max-sm:text-[13px] sm:px-3",
    "aria-[current=page]:bg-[var(--fill)] aria-[current=page]:font-semibold aria-[current=page]:text-[var(--text)]",
  );
  return (
    <ContentStickyHeader>
      <header
        data-content-header
        className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--panel-solid)]"
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-1 px-[var(--reading-gutter)] py-2">
          <a
            href={appLocalePaths[locale]}
            aria-label={APP_NAME}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md text-sm font-semibold tracking-tight whitespace-nowrap text-[var(--text)] transition-opacity hover:opacity-75 sm:gap-2.5 sm:text-base",
              focusRing,
            )}
          >
            <BrandLogo size={28} />
            <span translate="no">{APP_NAME}</span>
          </a>
          <div className="order-3 flex w-full min-w-0 flex-wrap items-center justify-between gap-1 md:order-none md:w-auto md:justify-center md:gap-2">
            <nav
              aria-label={copy.navigation}
              className="flex shrink-0 items-center gap-1"
            >
              {section === "guide" ? (
                <a
                  href={`${appGuidePaths[locale]}#guide-start`}
                  aria-current="page"
                  className={navClass}
                >
                  <BookOpen className="size-4 shrink-0" aria-hidden="true" />
                  {copy.guide}
                </a>
              ) : (
                <ContextGuideLink
                  locale={locale}
                  target="guide-start"
                  label={copy.guide}
                  navigation
                  className={navClass}
                >
                  <BookOpen className="size-4 shrink-0" aria-hidden="true" />
                </ContextGuideLink>
              )}
              <Link
                href={appArticlePaths[locale]}
                prefetch={false}
                aria-current={section === "articles" ? "page" : undefined}
                className={navClass}
              >
                <Newspaper className="size-4 shrink-0" aria-hidden="true" />
                {copy.articles}
              </Link>
            </nav>
            <div className="flex shrink-0 items-center">
              <ContentLanguageMenu
                preserveGuideSection={section === "guide"}
                label={copy.languages}
                current={locale}
                options={languages.map((language) => ({
                  locale: language,
                  name: languageNames[language],
                  href:
                    section === "guide"
                      ? appGuidePaths[language]
                      : `${appArticlePaths[language]}${slug ? `/${slug}` : ""}`,
                }))}
              />
              <ContentThemeToggle labels={copy} />
            </div>
          </div>
          <ContentEditorLink locale={locale} compact />
        </div>
      </header>
    </ContentStickyHeader>
  );
}

export function ContentEditorLink({
  locale,
  primary = false,
  compact = false,
}: {
  locale: AppLocale;
  primary?: boolean;
  compact?: boolean;
}) {
  return (
    <a
      href={appLocalePaths[locale]}
      aria-label={contentNavigationCopy[locale].editor}
      className={cn(
        actionStyles(primary ? "primary" : "quiet"),
        "shrink-0 justify-center text-sm whitespace-nowrap",
      )}
    >
      <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
      <span className={compact ? "max-[319px]:sr-only" : undefined}>
        {contentNavigationCopy[locale].editor}
      </span>
    </a>
  );
}
