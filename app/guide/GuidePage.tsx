import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  ChevronDown,
  ExternalLink,
  Info,
} from "lucide-react";
import Link from "next/link";
import { GuideExamples } from "./GuideExamples";
import { GuideSectionContent } from "./GuideSectionContent";
import { BrandLogo } from "@/features/graph-editor/ui/brand/BrandLogo";
import { EmptyStateIllustration } from "@/features/graph-editor/ui/chrome/EmptyStateIllustration";
import {
  GUIDE_LAST_MODIFIED,
  GUIDE_PUBLISHED_DATE,
  toIsoDate,
} from "@/lib/content-dates";
import { guideCopy, guideExampleCopy } from "@/lib/guide-content";
import {
  APP_NAME,
  appAuthorStructuredData,
  appGuidePaths,
  appLocaleMetadata,
  appLocalePaths,
  getAppGuideUrl,
  getAppLocaleUrl,
  REPOSITORY_URL,
  SITE_URL,
  type AppLocale,
} from "@/lib/site-metadata";

const guideLanguages = ["ja", "en", "zh-Hans"] as const;
const legacySectionIds: Readonly<Record<string, string>> = {
  import: "guide-section-0",
  draw: "guide-section-1",
  layouts: "guide-section-2",
  export: "guide-section-3",
  shortcuts: "guide-section-4",
};
const focusStyle =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]";
const insetFocusStyle =
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--accent)]";

/** The guide and diagrams render on the server; only copying needs client code. */
export function GuidePage({ locale }: { locale: AppLocale }) {
  const copy = guideCopy[locale];
  const entries = [
    { href: "#guide-start", title: copy.quickStartNavTitle },
    { href: "#guide-examples", title: guideExampleCopy[locale].navTitle },
    ...copy.sections.map((section) => ({
      href: `#guide-${section.id}`,
      title: section.navTitle,
    })),
    { href: "#guide-faq", title: copy.faqTitle },
  ];
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      "@id": `${getAppGuideUrl(locale)}#article`,
      headline: copy.heading,
      description: copy.description,
      url: getAppGuideUrl(locale),
      mainEntityOfPage: getAppGuideUrl(locale),
      inLanguage: locale,
      image: `${SITE_URL}${appLocaleMetadata[locale].ogImage}`,
      datePublished: GUIDE_PUBLISHED_DATE,
      dateModified: toIsoDate(GUIDE_LAST_MODIFIED),
      author: appAuthorStructuredData,
      publisher: appAuthorStructuredData,
      about: { "@id": `${getAppLocaleUrl(locale)}#app` },
      isAccessibleForFree: true,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: copy.faq.map((entry) => ({
        "@type": "Question",
        name: entry.question,
        acceptedAnswer: { "@type": "Answer", text: entry.answer },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: copy.breadcrumbHome,
          item: getAppLocaleUrl(locale),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: copy.heading,
          item: getAppGuideUrl(locale),
        },
      ],
    },
  ];
  return (
    <main
      id="guide-top"
      className="min-h-dvh bg-[var(--bg)] text-[var(--text)]"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <a
        href="#guide-content"
        className={`sr-only fixed top-3 left-3 z-50 rounded-lg bg-[var(--panel-solid)] px-4 py-3 text-sm focus:not-sr-only ${focusStyle}`}
      >
        {copy.skipToContent}
      </a>
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--bg)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <Link
            href={appLocalePaths[locale]}
            prefetch={false}
            aria-label={APP_NAME}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-lg text-sm font-semibold ${focusStyle}`}
          >
            <BrandLogo size={24} />
            <span className="hidden min-[360px]:inline" translate="no">
              {APP_NAME}
            </span>
          </Link>
          <Link
            href={appLocalePaths[locale]}
            prefetch={false}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel-solid)] px-3 text-[13px] font-medium transition-colors hover:bg-[var(--fill)] sm:px-4 sm:text-sm ${focusStyle}`}
          >
            <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
            {copy.openApp}
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 pt-8 pb-12 sm:px-8 sm:pt-12 sm:pb-16">
        <header className="mb-8 sm:mb-10">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <p className="inline-flex items-center gap-2 text-xs font-medium text-[var(--accent-text)] sm:text-sm">
              <BookOpen className="size-4" aria-hidden="true" />
              {copy.guideLink}
            </p>
            <nav aria-label={copy.languages} className="flex flex-wrap gap-1">
              {guideLanguages.map((language) => (
                <Link
                  key={language}
                  href={appGuidePaths[language]}
                  prefetch={false}
                  hrefLang={language}
                  lang={language}
                  aria-current={locale === language ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center rounded-lg px-3 text-xs transition-colors hover:bg-[var(--fill)] ${focusStyle} ${locale === language ? "bg-[var(--fill)] font-semibold text-[var(--text)]" : "text-[var(--muted)]"}`}
                >
                  {guideCopy[language].languageName}
                </Link>
              ))}
            </nav>
          </div>
          <h1 className="mt-4 max-w-3xl text-[26px] leading-tight font-semibold tracking-tight text-balance sm:text-4xl sm:leading-tight">
            {copy.heading}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--text-2)] sm:text-base sm:leading-8">
            {copy.intro}
          </p>
        </header>
        <div className="grid min-w-0 gap-8 lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-12">
          <aside className="min-w-0">
            <nav aria-label={copy.onThisPage} className="lg:sticky lg:top-24">
              <details className="group rounded-xl border border-[var(--line)] bg-[var(--panel-solid)] lg:hidden">
                <summary
                  className={`flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 text-sm font-medium [&::-webkit-details-marker]:hidden ${focusStyle}`}
                >
                  {copy.onThisPage}
                  <ChevronDown
                    className="size-4 shrink-0 text-[var(--muted)] group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <GuideContents
                  entries={entries}
                  className="border-t border-[var(--hair)] px-2 py-2"
                />
              </details>
              <div className="hidden lg:block">
                <p className="mb-3 px-3 text-xs font-semibold text-[var(--muted)]">
                  {copy.onThisPage}
                </p>
                <GuideContents
                  entries={entries}
                  className="border-l border-[var(--line)] pl-2"
                />
                <p
                  translate="no"
                  className="mt-6 px-3 text-xs text-[var(--muted)]"
                >
                  by daikusutora3
                </p>
              </div>
            </nav>
          </aside>
          <article
            id="guide-content"
            tabIndex={-1}
            className="min-w-0 scroll-mt-24"
          >
            <section
              id="guide-start"
              aria-labelledby="guide-start-title"
              className="scroll-mt-24"
            >
              <h2
                id="guide-start-title"
                className="text-xl font-semibold tracking-tight sm:text-2xl"
              >
                {copy.quickStartTitle}
              </h2>
              <p className="mt-3 text-sm leading-7 text-[var(--text-2)]">
                {copy.quickStartIntro}
              </p>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {copy.quickStartCards.map((card) => (
                  <div
                    key={card.id}
                    className="flex min-w-0 flex-col rounded-xl border border-[var(--line)] bg-[var(--panel-solid)] p-4"
                  >
                    <div className="mb-3 flex items-center gap-3 md:flex-col md:items-start">
                      <div className="h-14 w-16 shrink-0 text-[var(--text-2)] sm:h-16 sm:w-28 md:h-20 md:w-full">
                        <EmptyStateIllustration
                          method={card.id === "data" ? "paste" : card.id}
                        />
                      </div>
                      <h3 className="text-sm leading-6 font-semibold">
                        {card.title}
                      </h3>
                    </div>
                    <p className="text-[13px] leading-6 text-[var(--text-2)]">
                      {card.description}
                    </p>
                    <ol className="mt-3 flex-1 list-decimal space-y-1 pl-4 text-[13px] leading-6 text-[var(--text-2)] marker:text-[var(--muted)]">
                      {card.steps.map((step) => (
                        <li key={step} className="pl-1">
                          {step}
                        </li>
                      ))}
                    </ol>
                    <a
                      href={`#guide-${card.targetId}`}
                      className={`mt-3 inline-flex min-h-11 items-center justify-between gap-2 rounded text-xs font-medium text-[var(--accent-text)] ${focusStyle}`}
                    >
                      {card.id === "data"
                        ? copy.examplesLink
                        : copy.quickStartAction}
                      <ArrowRight
                        className="size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                    </a>
                  </div>
                ))}
              </div>
            </section>
            <GuideExamples locale={locale} />
            <div className="mt-10 space-y-10 sm:mt-14 sm:space-y-14">
              {copy.sections.map((section) => (
                <section
                  id={`guide-${section.id}`}
                  key={section.id}
                  aria-labelledby={`guide-${section.id}-title`}
                  className="scroll-mt-24 border-t border-[var(--line)] pt-8"
                >
                  {legacySectionIds[section.id] ? (
                    <span
                      id={legacySectionIds[section.id]}
                      className="block scroll-mt-24"
                      aria-hidden="true"
                    />
                  ) : null}
                  <h2
                    id={`guide-${section.id}-title`}
                    className="text-xl leading-snug font-semibold tracking-tight sm:text-2xl"
                  >
                    {section.title}
                  </h2>
                  <GuideSectionContent section={section} />
                  {section.id === "shortcuts" ? (
                    <p className="mt-4 text-xs leading-6 text-[var(--muted)]">
                      {copy.shortcutsNote}
                    </p>
                  ) : null}
                  {section.note ? (
                    <aside className="mt-5 flex gap-3 rounded-xl border border-[var(--line)] bg-[var(--accent-fill-soft)] p-4">
                      <Info
                        className="mt-0.5 size-4 shrink-0 text-[var(--accent-text)]"
                        aria-hidden="true"
                      />
                      <div className="min-w-0 text-sm leading-7">
                        <p className="font-medium">{section.note.title}</p>
                        <p className="mt-1 text-[var(--text-2)]">
                          {section.note.text}
                        </p>
                      </div>
                    </aside>
                  ) : null}
                </section>
              ))}
            </div>
            <section
              id="guide-faq"
              aria-labelledby="guide-faq-title"
              className="mt-10 scroll-mt-24 border-t border-[var(--line)] pt-8 sm:mt-14"
            >
              <h2
                id="guide-faq-title"
                className="text-xl font-semibold tracking-tight sm:text-2xl"
              >
                {copy.faqTitle}
              </h2>
              <p className="mt-3 text-sm leading-7 text-[var(--text-2)]">
                {copy.faqIntro}
              </p>
              <div className="mt-5 divide-y divide-[var(--line)] overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel-solid)]">
                {copy.faq.map((entry) => (
                  <details key={entry.question} className="group">
                    <summary
                      className={`flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-lg px-4 py-3 text-sm leading-6 font-medium sm:px-5 [&::-webkit-details-marker]:hidden ${insetFocusStyle}`}
                    >
                      {entry.question}
                      <ChevronDown
                        className="size-4 shrink-0 text-[var(--muted)] group-open:rotate-180"
                        aria-hidden="true"
                      />
                    </summary>
                    <p className="px-4 pb-4 text-sm leading-7 text-[var(--text-2)] sm:px-5">
                      {entry.answer}
                    </p>
                  </details>
                ))}
              </div>
            </section>
            <footer className="mt-10 border-t border-[var(--line)] pt-5 sm:mt-14">
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                <Link
                  href={appLocalePaths[locale]}
                  prefetch={false}
                  className={`inline-flex min-h-11 items-center gap-2 rounded text-sm font-medium text-[var(--accent-text)] ${focusStyle}`}
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  {copy.openApp}
                </Link>
                <a
                  href="#guide-top"
                  className={`inline-flex min-h-11 items-center gap-2 rounded text-xs text-[var(--muted)] ${focusStyle}`}
                >
                  {copy.backToTop}
                  <ArrowUp className="size-3.5" aria-hidden="true" />
                </a>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--muted)]">
                <span translate="no">Graph Editor · by daikusutora3</span>
                <a
                  href={REPOSITORY_URL}
                  rel="noreferrer"
                  className={`inline-flex min-h-11 items-center gap-2 rounded underline-offset-4 hover:underline ${focusStyle}`}
                >
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                  {copy.githubLink}
                </a>
              </div>
            </footer>
          </article>
        </div>
      </div>
    </main>
  );
}

function GuideContents({
  entries,
  className,
}: {
  entries: readonly { href: string; title: string }[];
  className: string;
}) {
  return (
    <ol className={className}>
      {entries.map((entry) => (
        <li key={entry.href}>
          <a
            href={entry.href}
            className={`flex min-h-11 items-center rounded-lg px-3 py-2 text-[13px] leading-5 text-[var(--text-2)] transition-colors hover:bg-[var(--fill)] hover:text-[var(--text)] ${focusStyle}`}
          >
            {entry.title}
          </a>
        </li>
      ))}
    </ol>
  );
}
