import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { GuideExamples } from "./GuideExamples";

import { BrandLogo } from "@/features/graph-editor/ui/brand/BrandLogo";
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

/** Static, fully server-rendered guide: real content for people and crawlers. */
export function GuidePage({ locale }: { locale: AppLocale }) {
  const copy = guideCopy[locale];
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
    <main className="min-h-dvh bg-[var(--bg)] text-[var(--text)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <header className="mx-auto max-w-4xl px-6 sm:px-8">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--line)] py-4">
          <Link
            href={appLocalePaths[locale]}
            aria-label={APP_NAME}
            className="inline-flex min-h-11 items-center gap-2.5 rounded-lg text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <BrandLogo size={24} />
            <span className="hidden sm:inline" translate="no">
              {APP_NAME}
            </span>
          </Link>
          <Link
            href={appLocalePaths[locale]}
            className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-[var(--line)] bg-[var(--panel-solid)] px-3.5 text-sm font-medium transition-colors hover:bg-[var(--fill)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
            {copy.openApp}
          </Link>
        </div>
      </header>
      <article className="mx-auto max-w-4xl px-6 pt-12 pb-12 sm:px-8 sm:pt-16 sm:pb-16">
        <header>
          <p className="text-sm font-medium text-[var(--muted)]">
            {copy.guideLink}
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl leading-snug font-semibold tracking-tight sm:text-4xl sm:leading-snug">
            {copy.heading}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-[var(--text-2)]">
            {copy.intro}
          </p>
        </header>

        <nav
          aria-label={copy.onThisPage}
          className="mt-8 border-y border-[var(--line)] py-4"
        >
          <p className="text-xs font-medium text-[var(--muted)]">
            {copy.onThisPage}
          </p>
          <ol className="mt-1 flex flex-wrap gap-x-6">
            {[
              {
                href: "#guide-examples",
                title: guideExampleCopy[locale].heading,
              },
              ...copy.sections.map((section, index) => ({
                href: `#guide-section-${index}`,
                title: section.title,
              })),
              { href: "#guide-faq", title: copy.faqTitle },
            ].map((entry) => (
              <li key={entry.href}>
                <a
                  href={entry.href}
                  className="inline-flex min-h-11 items-center rounded text-sm text-[var(--text-2)] underline-offset-4 transition-colors hover:text-[var(--text)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                >
                  {entry.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <GuideExamples locale={locale} />

        <div className="mt-12 space-y-12 sm:mt-16 sm:space-y-16">
          {copy.sections.map((section, index) => (
            <section
              id={`guide-section-${index}`}
              key={section.title}
              aria-labelledby={`guide-section-title-${index}`}
              className="scroll-mt-8 border-t border-[var(--line)] pt-10"
            >
              <h2
                id={`guide-section-title-${index}`}
                className="text-xl leading-snug font-semibold tracking-tight sm:text-2xl"
              >
                {section.title}
              </h2>
              {section.paragraphs?.map((paragraph) => (
                <p
                  key={paragraph}
                  className="mt-4 text-[15px] leading-7 text-[var(--text-2)]"
                >
                  {paragraph}
                </p>
              ))}
              {section.items ? (
                <ul className="mt-4 list-disc space-y-2.5 pl-5 text-[15px] leading-7 text-[var(--text-2)] marker:text-[var(--muted)]">
                  {section.items.map((item) => (
                    <li key={item} className="pl-1">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}
              {section.table ? (
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full min-w-[34rem] text-sm">
                    <thead className="border-b border-[var(--line)] text-left text-xs font-medium text-[var(--muted)]">
                      <tr>
                        <th scope="col" className="w-2/5 pr-6 pb-3 font-medium">
                          {section.table.head[0]}
                        </th>
                        <th scope="col" className="pb-3 font-medium">
                          {section.table.head[1]}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.table.rows.map(([name, example]) => (
                        <tr
                          key={name}
                          className="border-b border-[var(--hair)] last:border-0"
                        >
                          <th
                            scope="row"
                            className="py-3 pr-6 text-left font-medium"
                          >
                            {name}
                          </th>
                          <td className="py-3 font-mono text-xs leading-6 text-[var(--text-2)]">
                            {example}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>
          ))}
        </div>

        <section
          id="guide-faq"
          aria-labelledby="guide-faq-title"
          className="mt-12 scroll-mt-8 border-t border-[var(--line)] pt-10 sm:mt-16"
        >
          <h2
            id="guide-faq-title"
            className="text-xl font-semibold tracking-tight sm:text-2xl"
          >
            {copy.faqTitle}
          </h2>
          <dl className="mt-4 divide-y divide-[var(--hair)]">
            {copy.faq.map((entry) => (
              <div
                key={entry.question}
                className="grid gap-2 py-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-8"
              >
                <dt className="text-sm leading-7 font-semibold">
                  {entry.question}
                </dt>
                <dd className="text-sm leading-7 text-[var(--text-2)]">
                  {entry.answer}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <footer className="mt-12 border-t border-[var(--line)] pt-6 text-sm text-[var(--muted)]">
          <Link
            href={appLocalePaths[locale]}
            className="mb-4 inline-flex min-h-11 items-center gap-2 rounded font-medium text-[var(--text)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {copy.openApp}
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-6">
            <nav
              aria-label={copy.languages}
              className="flex flex-wrap items-center gap-5"
            >
              {guideLanguages.map((language) => (
                <Link
                  key={language}
                  href={appGuidePaths[language]}
                  hrefLang={language}
                  lang={language}
                  aria-current={locale === language ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center rounded text-xs underline-offset-4 hover:text-[var(--text)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${locale === language ? "font-medium text-[var(--text)] underline" : ""}`}
                >
                  {guideCopy[language].languageName}
                </Link>
              ))}
            </nav>
            <a
              href={REPOSITORY_URL}
              rel="noreferrer"
              className="inline-flex min-h-11 items-center rounded text-xs underline-offset-4 hover:text-[var(--text)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              {APP_NAME} on GitHub
            </a>
          </div>
        </footer>
      </article>
    </main>
  );
}
