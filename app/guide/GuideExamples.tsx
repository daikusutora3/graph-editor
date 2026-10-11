import { Disclosure } from "@/components/ui/Disclosure";
import { guideVisualCopy } from "@/lib/guide-visual-content";
import Image from "next/image";
import { RelatedLinks } from "@/components/content/RelatedLinks";
import { ContentSection } from "@/components/ui/ContentSection";
import { GuideCopyButton } from "./GuideCopyButton";
import { guideExamples } from "@/lib/guide-examples";
import { guideExampleCopy } from "@/lib/guide-content";
import {
  articleCopy,
  articlePath,
  getArticleForGuideExample,
} from "@/lib/article-content";
import type { AppLocale } from "@/lib/site-metadata";

export function GuideExamples({ locale }: { locale: AppLocale }) {
  const copy = guideExampleCopy[locale];
  return (
    <ContentSection
      id="guide-examples"
      variant="plain"
      title={copy.heading}
      description={guideVisualCopy[locale].exampleInstruction}
      className="mt-10 sm:mt-14"
    >
      {guideExamples.map((example, index) => {
        const text = copy.examples[index]!;
        const article = getArticleForGuideExample(locale, example.id);
        return (
          <ContentSection
            key={example.id}
            headingId={example.id}
            headingLevel={3}
            title={text.title}
            variant="plain"
            className="mt-6 scroll-mt-36 sm:mt-8 sm:scroll-mt-28"
          >
            <div className="mt-4 grid overflow-hidden rounded-lg border border-[var(--line)] @min-[32rem]/reading:grid-cols-2">
              <div className="min-w-0 bg-[var(--fill)] px-4 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 py-2">
                  <p className="text-sm font-medium text-[var(--muted)]">
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
              <figure className="min-w-0 border-t border-[var(--line)] bg-[var(--panel-solid)] p-4 @min-[32rem]/reading:border-t-0 @min-[32rem]/reading:border-l">
                <p className="text-sm font-medium text-[var(--muted)]">
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
              </figure>
            </div>
            <Disclosure
              title={guideVisualCopy[locale].details}
              variant="compact"
              className="mt-2"
            >
              <p>{copy.instruction}</p>
              <p className="mt-2">{text.description}</p>
              <p className="mt-2">{text.result}</p>
            </Disclosure>
            {article ? (
              <RelatedLinks
                title={articleCopy[locale].relatedTitle}
                label={`${text.title}: ${articleCopy[locale].relatedTitle}`}
                className="mt-5"
                links={[
                  {
                    href: articlePath(locale, article.slug),
                    title: article.title,
                  },
                ]}
              />
            ) : null}
          </ContentSection>
        );
      })}
    </ContentSection>
  );
}
