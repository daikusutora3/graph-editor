import { ArrowLeft, Languages } from "lucide-react";
import Link from "next/link";
import { Disclosure } from "@/components/ui/Disclosure";
import {
  actionStyles,
  focusRing,
  insetFocusRing,
} from "@/components/ui/styles";
import { BrandLogo } from "@/features/graph-editor/ui/brand/BrandLogo";
import { guideCopy } from "@/lib/guide-content";
import {
  APP_NAME,
  appGuidePaths,
  appLocalePaths,
  type AppLocale,
} from "@/lib/site-metadata";
import { cn } from "@/lib/utils";

const guideLanguages = ["ja", "en", "zh-Hans"] as const;
type ContentsEntry = { href: string; title: string };

export function GuideHeader({ locale }: { locale: AppLocale }) {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--panel-solid)]">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-8">
        <Link
          href={appLocalePaths[locale]}
          prefetch={false}
          aria-label={APP_NAME}
          className={cn(
            "inline-flex min-h-11 shrink-0 items-center gap-3 rounded-lg text-[15px] font-semibold tracking-tight",
            focusRing,
          )}
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-[var(--line)] bg-[var(--bg)]">
            <BrandLogo size={26} />
          </span>
          <span className="hidden min-[360px]:inline" translate="no">
            {APP_NAME}
          </span>
        </Link>
        <GuideEditorLink locale={locale} />
      </div>
    </header>
  );
}

export function GuideEditorLink({
  locale,
  primary = false,
}: {
  locale: AppLocale;
  primary?: boolean;
}) {
  return (
    <Link
      href={appLocalePaths[locale]}
      prefetch={false}
      className={cn(
        actionStyles(primary ? "primary" : "quiet"),
        "shrink-0 justify-center text-[13px] whitespace-nowrap sm:text-sm",
      )}
    >
      {primary ? (
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[color-mix(in_oklab,var(--primary-text)_12%,transparent)]">
          <ArrowLeft className="size-3.5" aria-hidden="true" />
        </span>
      ) : (
        <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
      )}
      {guideCopy[locale].openApp}
    </Link>
  );
}

export function GuideLanguageSwitcher({ locale }: { locale: AppLocale }) {
  return (
    <nav
      aria-label={guideCopy[locale].languages}
      className="inline-flex max-w-full shrink-0 items-center gap-0.5 rounded-full border border-[var(--line)] bg-[var(--fill)] p-1"
    >
      <Languages
        className="mx-2 size-4 shrink-0 text-[var(--muted)]"
        aria-hidden="true"
      />
      {guideLanguages.map((language) => (
        <Link
          key={language}
          href={appGuidePaths[language]}
          prefetch={false}
          hrefLang={language}
          lang={language}
          aria-current={locale === language ? "page" : undefined}
          className={cn(
            "inline-flex min-h-11 items-center justify-center rounded-full border px-3 text-xs whitespace-nowrap transition-colors",
            insetFocusRing,
            locale === language
              ? "border-[var(--line)] bg-[var(--panel-solid)] font-semibold text-[var(--text)] shadow-sm"
              : "border-transparent font-medium text-[var(--text-2)] hover:bg-[var(--fill-2)] hover:text-[var(--text)]",
          )}
        >
          {guideCopy[language].languageName}
        </Link>
      ))}
    </nav>
  );
}

export function GuideContents({
  title,
  entries,
}: {
  title: string;
  entries: readonly ContentsEntry[];
}) {
  return (
    <aside className="min-w-0">
      <nav aria-label={title} className="lg:sticky lg:top-24">
        <Disclosure title={title} className="lg:hidden">
          <ContentsLinks entries={entries} />
        </Disclosure>
        <div className="hidden lg:block">
          <p className="mb-3 px-3 text-xs font-semibold text-[var(--muted)]">
            {title}
          </p>
          <ContentsLinks
            entries={entries}
            className="border-l border-[var(--line)] pl-2"
          />
          <p translate="no" className="mt-6 px-3 text-xs text-[var(--muted)]">
            by daikusutora3
          </p>
        </div>
      </nav>
    </aside>
  );
}

function ContentsLinks({
  entries,
  className,
}: {
  entries: readonly ContentsEntry[];
  className?: string;
}) {
  return (
    <ol className={className}>
      {entries.map((entry) => (
        <li key={entry.href}>
          <a
            href={entry.href}
            className={cn(actionStyles(), "w-full text-[13px] leading-5")}
          >
            {entry.title}
          </a>
        </li>
      ))}
    </ol>
  );
}
