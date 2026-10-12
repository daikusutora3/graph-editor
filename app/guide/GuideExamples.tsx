import { Disclosure } from "@/components/ui/Disclosure";
import { guideVisualCopy } from "@/lib/guide-visual-content";
import Image from "next/image";
import { RelatedLinks } from "@/components/content/RelatedLinks";
import { ContentSection } from "@/components/ui/ContentSection";
import { ContentExample } from "@/components/content/ContentExample";
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
            <ContentExample
              input={example.input}
              title={text.title}
              labels={copy}
            >
              <div className="flex w-full items-center justify-center rounded-lg bg-white p-3">
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
            </ContentExample>
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
