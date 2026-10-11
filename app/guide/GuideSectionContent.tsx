import { GuideOperationVisual } from "./GuideOperationVisual";
import { guideVisualCopy } from "@/lib/guide-visual-content";
import type { AppLocale } from "@/lib/site-metadata";
import { Callout } from "@/components/ui/Callout";
import { Disclosure } from "@/components/ui/Disclosure";
import type { GuideSection } from "@/lib/guide-content";
import { bodyText, readingMeasure } from "@/components/ui/styles";
import { cn } from "@/lib/utils";

export function GuideSectionContent({
  section,
  locale,
}: {
  section: GuideSection;
  locale: AppLocale;
}) {
  return (
    <>
      {section.description ? (
        <p className={cn("mt-3", bodyText, readingMeasure)}>
          {section.description}
        </p>
      ) : null}
      <GuideOperationVisual id={section.id} locale={locale} />
      {section.shortcuts ? (
        <dl className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-x-8 rounded-xl bg-[var(--panel-solid)] px-4">
          {section.shortcuts.map((shortcut) => (
            <div
              key={shortcut.action}
              className="grid content-start gap-2 py-3"
            >
              <dt className="text-base leading-7">{shortcut.action}</dt>
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
      <Disclosure
        variant="compact"
        title={guideVisualCopy[locale].details}
        className="mt-3"
      >
        {section.paragraphs?.map((paragraph) => (
          <p key={paragraph} className="mt-4 text-[var(--text-2)]">
            {paragraph}
          </p>
        ))}
        {section.steps ? (
          <ol className="mt-5 space-y-4">
            {section.steps.map((step, index) => (
              <li
                key={step.title}
                className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3 gap-y-1"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--fill)] text-xs font-semibold text-[var(--muted)]"
                >
                  {index + 1}
                </span>
                <h3 className="min-w-0 font-medium text-[var(--text)]">
                  {step.title}
                </h3>
                <p className="col-span-2 text-[var(--text-2)] sm:col-span-1 sm:col-start-2">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        ) : null}
        {section.items ? (
          <ul className="mt-4 list-disc space-y-2 pl-5 text-[var(--text-2)] marker:text-[var(--muted)]">
            {section.items.map((item) => (
              <li key={item} className="pl-1">
                {item}
              </li>
            ))}
          </ul>
        ) : null}
        {section.table ? (
          <Disclosure title={section.table.title} className="mt-5">
            <dl className="divide-y divide-[var(--hair)]">
              {section.table.rows.map(([name, example]) => (
                <div
                  key={name}
                  className="grid min-w-0 gap-2 py-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-6"
                >
                  <dt className="text-base leading-7 font-medium">{name}</dt>
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
          </Disclosure>
        ) : null}
        {section.note ? (
          <Callout title={section.note.title} className="mt-5">
            <p>{section.note.text}</p>
          </Callout>
        ) : null}
      </Disclosure>
    </>
  );
}
