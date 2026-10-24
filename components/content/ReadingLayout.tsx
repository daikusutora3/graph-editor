import type { ReactNode } from "react";
import { contentNavigationCopy } from "@/lib/content-navigation";
import type { AppLocale } from "@/lib/site-metadata";
import { ContentContents } from "./ContentContents";
import { ContentHeader } from "./ContentNavigation";
import readingStyles from "./ReadingLayout.module.css";
import { bodyText, readingMeasure, focusRing } from "@/components/ui/styles";
import { cn } from "@/lib/utils";

export function ReadingContainer({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-[var(--reading-gutter)] pt-8 pb-12 sm:pt-12 sm:pb-16">
      {children}
    </div>
  );
}

export function ReadingIntro({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-8 sm:mb-10">
      <h1 className="max-w-3xl text-[clamp(1.625rem,1.125rem+2.5vw,2.25rem)] leading-tight font-semibold tracking-tight text-balance">
        {title}
      </h1>
      <p className={cn("mt-4", bodyText, readingMeasure)}>{description}</p>
      {children}
    </header>
  );
}

export function ReadingBody({
  id,
  locale,
  entries,
  children,
}: {
  id: string;
  locale: AppLocale;
  entries: readonly { href: string; title: string }[];
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 lg:grid lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-12">
      <ContentContents
        title={contentNavigationCopy[locale].contents}
        entries={entries}
      />
      <article id={id} tabIndex={-1} className="@container/reading min-w-0">
        {children}
      </article>
    </div>
  );
}

export function ReadingPage({
  locale,
  section,
  slug,
  topId,
  contentId,
  skipLabel,
  structuredData,
  children,
}: {
  locale: AppLocale;
  section: "guide" | "articles";
  slug?: string;
  topId: string;
  contentId: string;
  skipLabel: string;
  structuredData: Record<string, unknown> | readonly Record<string, unknown>[];
  children: ReactNode;
}) {
  return (
    <main
      id={topId}
      data-reading
      className={cn(
        "min-h-dvh bg-[var(--bg)] [overflow-wrap:anywhere] text-[var(--text)]",
        readingStyles.page,
      )}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <a
        href={`#${contentId}`}
        className={cn(
          "sr-only fixed top-3 left-3 z-50 rounded-lg bg-[var(--panel-solid)] px-4 py-3 text-sm focus:not-sr-only",
          focusRing,
        )}
      >
        {skipLabel}
      </a>
      <ContentHeader locale={locale} section={section} slug={slug} />
      {children}
    </main>
  );
}
