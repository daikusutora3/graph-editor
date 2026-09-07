import Image from "next/image";
import { guideExamples } from "@/lib/guide-examples";
import { guideExampleCopy } from "@/lib/guide-content";
import type { AppLocale } from "@/lib/site-metadata";

export function GuideExamples({ locale }: { locale: AppLocale }) {
  const copy = guideExampleCopy[locale];
  return (
    <section aria-labelledby="guide-examples" className="mt-12">
      <h2 id="guide-examples" className="text-xl font-bold">
        {copy.heading}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-[var(--text-2)]">
        {copy.instruction}
      </p>
      {guideExamples.map((example, index) => {
        const text = copy.examples[index]!;
        return (
          <section
            key={example.id}
            aria-labelledby={example.id}
            className="mt-8"
          >
            <h3 id={example.id} className="text-base font-bold">
              {text.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-2)]">
              {text.description}
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold text-[var(--muted)]">
                  {copy.input}
                </p>
                <pre className="overflow-x-auto rounded-lg bg-[var(--fill)] p-4 text-sm">
                  <code>{example.input}</code>
                </pre>
              </div>
              <figure>
                <Image
                  src={`/guide/${example.id}.png`}
                  alt={text.result}
                  width={example.imageWidth}
                  height={1280}
                  unoptimized
                  className="mx-auto h-auto max-h-80 w-auto max-w-full rounded-lg bg-white p-3"
                />
                <figcaption className="mt-3 text-xs leading-relaxed text-[var(--text-2)]">
                  {copy.result}: {text.result}
                </figcaption>
              </figure>
            </div>
          </section>
        );
      })}
    </section>
  );
}
