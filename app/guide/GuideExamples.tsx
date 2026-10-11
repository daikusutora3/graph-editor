import Image from "next/image";
import { ContentSection } from "@/components/ui/ContentSection";
import { GuideCopyButton } from "./GuideCopyButton";
import { guideExamples } from "@/lib/guide-examples";
import { guideExampleCopy } from "@/lib/guide-content";
import type { AppLocale } from "@/lib/site-metadata";

export function GuideExamples({ locale }: { locale: AppLocale }) {
  const copy = guideExampleCopy[locale];
  return (
    <ContentSection
      id="guide-examples"
      title={copy.heading}
      description={copy.instruction}
      className="mt-10 sm:mt-14"
    >
      {guideExamples.map((example, index) => {
        const text = copy.examples[index]!;
        return (
          <ContentSection
            key={example.id}
            headingId={example.id}
            headingLevel={3}
            title={text.title}
            description={text.description}
            variant="card"
            className="mt-6 sm:mt-8"
          >
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
          </ContentSection>
        );
      })}
    </ContentSection>
  );
}
