import Link from "next/link";

import { guideCopy } from "@/lib/guide-content";
import {
  APP_NAME,
  appLocalePaths,
  getAppGuideUrl,
  getAppLocaleUrl,
  type AppLocale,
} from "@/lib/site-metadata";

const REPOSITORY_URL = "https://github.com/daikusutora3/graph-editor";

/** Static, fully server-rendered guide: real content for people and crawlers. */
export function GuidePage({ locale }: { locale: AppLocale }) {
  const copy = guideCopy[locale];
  const structuredData = [
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
      <article className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <nav
          aria-label="Breadcrumb"
          className="text-meta font-semibold text-[var(--muted)]"
        >
          <ol className="flex items-center gap-2">
            <li>
              <Link
                href={appLocalePaths[locale]}
                className="hover:text-[var(--text)]"
              >
                {copy.breadcrumbHome}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">{copy.heading}</li>
          </ol>
        </nav>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">
          {copy.heading}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[var(--text-2)]">
          {copy.intro}
        </p>
        <p className="mt-6">
          <Link
            href={appLocalePaths[locale]}
            className="inline-flex h-10 items-center rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-text)]"
          >
            {copy.openApp}
          </Link>
        </p>

        {copy.sections.map((section) => (
          <section key={section.title} className="mt-12">
            <h2 className="text-xl font-bold">{section.title}</h2>
            {section.paragraphs?.map((paragraph) => (
              <p
                key={paragraph}
                className="mt-3 text-sm leading-relaxed text-[var(--text-2)]"
              >
                {paragraph}
              </p>
            ))}
            {section.items ? (
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-[var(--text-2)]">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
            {section.table ? (
              <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--line)]">
                <table className="w-full text-sm">
                  <thead className="text-meta bg-[var(--fill)] text-left font-semibold text-[var(--muted)]">
                    <tr>
                      <th className="px-3 py-2">{section.table.head[0]}</th>
                      <th className="px-3 py-2">{section.table.head[1]}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.table.rows.map(([name, example]) => (
                      <tr key={name} className="border-t border-[var(--hair)]">
                        <td className="px-3 py-2 font-semibold">{name}</td>
                        <td className="px-3 py-2 font-mono text-[var(--text-2)]">
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

        <section className="mt-12">
          <h2 className="text-xl font-bold">{copy.faqTitle}</h2>
          <dl className="mt-3 space-y-5">
            {copy.faq.map((entry) => (
              <div key={entry.question}>
                <dt className="text-sm font-bold">{entry.question}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-[var(--text-2)]">
                  {entry.answer}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <footer className="text-meta mt-14 border-t border-[var(--hair)] pt-6 text-[var(--muted)]">
          <a
            href={REPOSITORY_URL}
            rel="noreferrer"
            className="hover:text-[var(--text)]"
          >
            {APP_NAME} on GitHub
          </a>
        </footer>
      </article>
    </main>
  );
}
