import { ChevronDown } from "lucide-react";
import type { GuideSection } from "@/lib/guide-content";

export function GuideSectionContent({ section }: { section: GuideSection }) {
  return (
    <>
      {section.description ? (
        <p className="mt-3 text-sm leading-7 text-[var(--text-2)]">
          {section.description}
        </p>
      ) : null}
      {section.paragraphs?.map((paragraph) => (
        <p
          key={paragraph}
          className="mt-4 text-sm leading-7 text-[var(--text-2)]"
        >
          {paragraph}
        </p>
      ))}
      {section.steps ? (
        <ol className="mt-5 space-y-4">
          {section.steps.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--fill)] text-xs font-semibold text-[var(--muted)]"
              >
                {index + 1}
              </span>
              <div className="min-w-0 text-sm leading-7">
                <h3 className="font-medium">{step.title}</h3>
                <p className="text-[var(--text-2)]">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
      {section.items ? (
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-[var(--text-2)] marker:text-[var(--muted)]">
          {section.items.map((item) => (
            <li key={item} className="pl-1">
              {item}
            </li>
          ))}
        </ul>
      ) : null}
      {section.table ? (
        <details className="group mt-5 rounded-xl border border-[var(--line)] bg-[var(--panel-solid)]">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--text-2)] [&::-webkit-details-marker]:hidden">
            {section.table.title}
            <ChevronDown
              className="size-4 shrink-0 text-[var(--muted)] group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <dl className="divide-y divide-[var(--hair)] border-t border-[var(--line)] px-4">
            {section.table.rows.map(([name, example]) => (
              <div
                key={name}
                className="grid min-w-0 gap-2 py-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-6"
              >
                <dt className="text-sm leading-6 font-medium">{name}</dt>
                <dd className="min-w-0">
                  <pre
                    className="overflow-x-auto rounded-lg bg-[var(--fill)] p-3 font-mono text-xs leading-6"
                    translate="no"
                  >
                    <code>{example}</code>
                  </pre>
                </dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
      {section.shortcuts ? (
        <dl className="mt-5 divide-y divide-[var(--hair)] rounded-xl border border-[var(--line)] bg-[var(--panel-solid)] px-4">
          {section.shortcuts.map((shortcut) => (
            <div
              key={shortcut.action}
              className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center sm:gap-6"
            >
              <dt className="text-sm leading-6">{shortcut.action}</dt>
              <dd className="flex flex-wrap gap-1.5">
                {shortcut.keys.map((key) => (
                  <kbd
                    key={key}
                    translate="no"
                    className="rounded-md border border-[var(--line)] bg-[var(--fill)] px-2 py-1 font-mono text-xs leading-5 text-[var(--text-2)]"
                  >
                    {key}
                  </kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </>
  );
}
