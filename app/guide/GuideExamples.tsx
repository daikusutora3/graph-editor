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
            className="mt-6 scroll-mt-36 sm:mt-8 sm:scroll-mt-28"
          >
            <p className="mt-2 text-sm leading-7 text-[var(--text-2)]">
              {text.description}
            </p>
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
            {article ? (
              <RelatedLinks
                title={articleCopy[locale].relatedTitle}
                label={`${text.title}: ${articleCopy[locale].relatedTitle}`}
                className="mt-3"
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
