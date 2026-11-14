import type { GuideSection } from "@/lib/guide-content";
import type { AppLocale } from "@/lib/site-metadata";
import { GuideOperationVisual } from "./GuideOperationVisual";
import { reading } from "@/components/content/reading";
import { cn } from "@/lib/utils";

/**
 * Which illustration panels a topic shows. Only panels that clarify the text
 * are used; topics that read fine as text (keyboard shortcuts) have none.
 */
const sectionFigures: Readonly<Record<string, readonly number[]>> = {
  import: [1],
  draw: [1],
  appearance: [0],
  layouts: [2],
  export: [0, 1, 2, 3],
  touch: [1],
};

/**
 * One guide topic as plain reference content: a one-line summary, an
 * illustration where it helps, then the steps and notes in full. Nothing is
 * collapsed, so readers can scan the page and find an operation quickly.
 */
export function GuideSectionContent({
  section,
  locale,
}: {
  section: GuideSection;
  locale: AppLocale;
}) {
  const figures = sectionFigures[section.id];
  return (
    <div className={cn("mt-3 space-y-5", reading.body)}>
      {section.description ? <p>{section.description}</p> : null}

      {figures ? (
        <GuideOperationVisual id={section.id} locale={locale} steps={figures} />
      ) : null}

      {section.steps ? (
        <ol className={reading.steps}>
          {section.steps.map((step) => (
            <li key={step.title} className="pl-1">
              <span className="font-semibold text-[var(--text)]">
                {step.title}
              </span>
              <span className="block">{step.description}</span>
            </li>
          ))}
        </ol>
      ) : null}

      {section.paragraphs?.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}

      {section.items ? (
        <ul className={reading.list}>
          {section.items.map((item) => (
            <li key={item} className="pl-1">
              {item}
            </li>
          ))}
        </ul>
      ) : null}

      {section.shortcuts ? (
        <dl className={cn(reading.rows, "text-sm")}>
          {section.shortcuts.map((shortcut) => (
            <div
              key={shortcut.action}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-2.5"
            >
              <dt className="min-w-0 text-[var(--text)]">{shortcut.action}</dt>
              <dd className="flex flex-wrap gap-1.5">
                {shortcut.keys.map((key) => (
                  <kbd
                    key={key}
                    translate="no"
                    className="rounded-md bg-[var(--fill)] px-1.5 py-0.5 font-mono text-xs leading-5 text-[var(--text-2)]"
                  >
                    {key}
                  </kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {section.table ? (
        <div>
          <h3 className={reading.subheading}>{section.table.title}</h3>
          <dl className={cn("mt-2", reading.rows)}>
            {section.table.rows.map(([name, example]) => (
              <div
                key={name}
                className="grid min-w-0 gap-2 py-3 text-sm sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-6"
              >
                <dt className="font-medium text-[var(--text)]">{name}</dt>
                <dd className="min-w-0">
                  <pre className={reading.code} translate="no">
                    <code>{example}</code>
                  </pre>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {section.note ? (
        <div>
          <h3 className={reading.subheading}>{section.note.title}</h3>
          <p className="mt-1">{section.note.text}</p>
        </div>
      ) : null}
    </div>
  );
}
