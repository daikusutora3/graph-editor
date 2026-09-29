import Image from "next/image";
import { guideExamples } from "@/lib/guide-examples";
import { guideExampleCopy } from "@/lib/guide-content";
import type { AppLocale } from "@/lib/site-metadata";

export function GuideExamples({ locale }: { locale: AppLocale }) {
  const copy = guideExampleCopy[locale];
  return (
    <section aria-labelledby="guide-examples" className="mt-12 sm:mt-16">
      <h2
        id="guide-examples"
        className="scroll-mt-8 text-xl font-semibold tracking-tight sm:text-2xl"
      >
        {copy.heading}
      </h2>
      <p className="mt-4 max-w-3xl text-[15px] leading-7 text-[var(--text-2)]">
        {copy.instruction}
      </p>
      {guideExamples.map((example, index) => {
        const text = copy.examples[index]!;
        return (
          <section
            key={example.id}
            aria-labelledby={example.id}
            className="mt-10"
          >
            <h3 id={example.id} className="text-base font-semibold">
              {text.title}
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--text-2)]">
              {text.description}
            </p>
            <div className="mt-4 grid overflow-hidden rounded-xl border border-[var(--line)] sm:grid-cols-2">
              <div className="min-w-0 bg-[var(--fill)] p-5 sm:p-6">
                <p className="text-xs font-medium text-[var(--muted)]">
                  {copy.input}
                </p>
                <pre className="mt-4 overflow-x-auto text-sm leading-7">
                  <code>{example.input}</code>
                </pre>
              </div>
              <figure className="min-w-0 border-t border-[var(--line)] bg-[var(--panel-solid)] p-5 sm:border-t-0 sm:border-l sm:p-6">
                <p className="text-xs font-medium text-[var(--muted)]">
                  {copy.result}
                </p>
                <div className="mt-4 flex items-center justify-center rounded-lg bg-white p-3">
                  <Image
                    src={`/guide/${example.id}.png`}
                    alt={text.result}
                    width={example.imageWidth}
                    height={1280}
                    unoptimized
                    loading={index === 0 ? "eager" : "lazy"}
                    className="h-auto max-h-56 w-auto max-w-full"
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
