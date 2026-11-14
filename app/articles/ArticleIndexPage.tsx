import { LinkList } from "@/components/content/LinkList";
import { TextLink } from "@/components/content/TextLink";
import { guideCopy } from "@/lib/guide-content";
import { ArticleThumbnail } from "./ArticleThumbnail";
import { ContentFooter } from "@/components/content/ContentFooter";
import {
  ReadingPage,
  ReadingContainer,
  ReadingIntro,
} from "@/components/content/ReadingLayout";
import { articleCopy, articlePath, getArticles } from "@/lib/article-content";
import {
  appGuidePaths,
  getAppPathUrl,
  type AppLocale,
} from "@/lib/site-metadata";

export function ArticleIndexPage({ locale }: { locale: AppLocale }) {
  const copy = articleCopy[locale];
  const articles = getArticles(locale);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: copy.heading,
    itemListElement: articles.map((article, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: article.title,
      url: getAppPathUrl(articlePath(locale, article.slug)),
    })),
  };

  return (
    <ReadingPage
      locale={locale}
      section="articles"
      topId="articles-top"
      contentId="articles-content"
      skipLabel={copy.skipToContent}
      structuredData={structuredData}
    >
      <ReadingContainer>
        <ReadingIntro title={copy.heading} description={copy.indexIntro}>
          <p className="mt-2">
            <TextLink href={appGuidePaths[locale]} arrow>
              {guideCopy[locale].heading}
            </TextLink>
          </p>
        </ReadingIntro>
        <div id="articles-content" tabIndex={-1} className="outline-none">
          <LinkList
            headingLevel={2}
            items={articles.map((article) => ({
              href: articlePath(locale, article.slug),
              title: article.title,
              description: article.description,
              meta: article.category,
              figure: <ArticleThumbnail article={article} />,
              outline: article.sections.map((section) => section.title),
            }))}
          />
        </div>
        <ContentFooter locale={locale} topId="articles-top" />
      </ReadingContainer>
    </ReadingPage>
  );
}
