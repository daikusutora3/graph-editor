import { ArrowLeft, BookOpen, Languages, Newspaper } from "lucide-react";
import Link from "next/link";
import { BrandLogo } from "@/features/graph-editor/ui/brand/BrandLogo";
import {
  actionStyles,
  focusRing,
  insetFocusRing,
} from "@/components/ui/styles";
import { contentNavigationCopy } from "@/lib/content-navigation";
import {
  APP_NAME,
  appArticlePaths,
  appGuidePaths,
  appLocalePaths,
  type AppLocale,
} from "@/lib/site-metadata";
import { cn } from "@/lib/utils";
import { ContextGuideLink } from "./ContextGuideLink";

type ReadingSection = "articles" | "guide";
const languages = ["ja", "en", "zh-Hans"] as const;
const languageNames = { ja: "日本語", en: "English", "zh-Hans": "简体中文" };

export function ContentHeader({
  locale,
  section,
}: {
  locale: AppLocale;
  section: ReadingSection;
  slug?: string;
}) {
  const copy = contentNavigationCopy[locale];
  const navClass = cn(
    actionStyles(),
    "text-sm",
    "aria-[current=page]:bg-[var(--fill)] aria-[current=page]:font-semibold aria-[current=page]:text-[var(--text)]",
  );
  return (
    <header
      data-content-header
      className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--panel-solid)]"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2 sm:px-8">
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
        <nav
          aria-label={copy.navigation}
          className="order-3 flex w-full flex-wrap items-center justify-center gap-1 sm:order-none sm:w-auto"
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
        <ContentEditorLink locale={locale} />
      </div>
    </header>
  );
}

export function ContentEditorLink({
  locale,
  primary = false,
}: {
  locale: AppLocale;
  primary?: boolean;
}) {
  return (
    <a
      href={appLocalePaths[locale]}
      className={cn(
        actionStyles(primary ? "primary" : "quiet"),
        "justify-center text-sm",
      )}
    >
      <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
      {contentNavigationCopy[locale].editor}
    </a>
  );
}

export function ContentLanguageSwitcher({
  locale,
  section,
  slug,
  fragment = "",
}: {
  locale: AppLocale;
  section: ReadingSection;
  slug?: string;
  fragment?: string;
}) {
  return (
    <nav
      aria-label={contentNavigationCopy[locale].languages}
      className="inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-2xl border border-[var(--line)] bg-[var(--fill)] p-1"
    >
      <Languages
        className="mx-2 size-4 shrink-0 text-[var(--muted)]"
        aria-hidden="true"
      />
      {languages.map((language) => (
        <a
          key={language}
          href={
            section === "guide"
              ? `${appGuidePaths[language]}${fragment}`
              : `${appArticlePaths[language]}${slug ? `/${slug}` : ""}`
          }
          hrefLang={language}
          lang={language}
          aria-current={locale === language ? "page" : undefined}
          className={cn(
            "inline-flex min-h-11 items-center justify-center rounded-xl border px-3 text-xs transition-colors active:bg-[var(--fill-2)]",
            insetFocusRing,
            locale === language
              ? "border-[var(--line)] bg-[var(--panel-solid)] font-semibold text-[var(--text)] shadow-sm"
              : "border-transparent font-medium text-[var(--text-2)] hover:text-[var(--text)]",
          )}
        >
          {languageNames[language]}
        </a>
      ))}
    </nav>
  );
}
