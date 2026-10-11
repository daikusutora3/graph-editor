import Image from "next/image";
import { GuideCopyButton } from "./GuideCopyButton";
import { guideExamples } from "@/lib/guide-examples";
import { guideExampleCopy } from "@/lib/guide-content";
import type { AppLocale } from "@/lib/site-metadata";

export function GuideExamples({ locale }: { locale: AppLocale }) {
  const copy = guideExampleCopy[locale];
  return (
    <section
      id="guide-examples"
      aria-labelledby="guide-examples-title"
      className="mt-10 scroll-mt-24 border-t border-[var(--line)] pt-8 sm:mt-14"
    >
      <h2
        id="guide-examples-title"
        className="text-xl font-semibold tracking-tight sm:text-2xl"
      >
        {copy.heading}
      </h2>
      <p className="mt-3 text-sm leading-7 text-[var(--text-2)]">
        {copy.instruction}
      </p>
      {guideExamples.map((example, index) => {
        const text = copy.examples[index]!;
        return (
          <section
            key={example.id}
            aria-labelledby={example.id}
            className="mt-6 scroll-mt-24 rounded-xl border border-[var(--line)] bg-[var(--panel-solid)] p-4 sm:mt-8 sm:p-5"
          >
            <h3
              id={example.id}
              className="scroll-mt-24 text-sm leading-6 font-semibold sm:text-base"
            >
              {text.title}
            </h3>
            <p className="mt-2 text-sm leading-7 text-[var(--text-2)]">
              {text.description}
            </p>
            <div className="mt-4 grid overflow-hidden rounded-lg border border-[var(--line)] sm:grid-cols-2">
              <div className="min-w-0 bg-[var(--fill)] px-4 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 py-2">
                  <p className="text-xs font-medium text-[var(--muted)]">
                    {copy.input}
                  </p>
                  <GuideCopyButton
                    text={example.input}
                    title={text.title}
                    labels={{
                      copy: copy.copy,
                      copySuccess: copy.copySuccess,
                      copyFailure: copy.copyFailure,
                    }}
                  />
                </div>
                <pre
                  className="overflow-x-auto font-mono text-sm leading-7"
                  translate="no"
                >
                  <code>{example.input}</code>
                </pre>
              </div>
              <figure className="min-w-0 border-t border-[var(--line)] bg-[var(--panel-solid)] p-4 sm:border-t-0 sm:border-l">
                <p className="text-xs font-medium text-[var(--muted)]">
                  {copy.result}
                </p>
                <div className="mt-3 flex items-center justify-center rounded-lg bg-white p-3">
                  <Image
                    src={`/guide/${example.id}.png`}
                    alt={text.result}
                    width={example.imageWidth}
                    height={1280}
                    unoptimized
                    loading="lazy"
                    className="h-auto max-h-44 w-auto max-w-full"
                  />
                </div>
                <figcaption className="mt-3 text-xs leading-6 text-[var(--text-2)]">
                  {text.result}
                </figcaption>
              </figure>
            </div>
          </section>
        );
      })}
    </section>
  );
}
