import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticlePage } from "@/app/articles/ArticlePage";
import { articleSlugs, getArticle } from "@/lib/article-content";
import { createArticlePageMetadata } from "@/lib/site-metadata";

export const dynamicParams = false;

export function generateStaticParams() {
  return articleSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle("ja", slug);
  return article ? createArticlePageMetadata("ja", article) : {};
}

export default async function JapaneseArticle({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticle("ja", slug);
  if (!article) notFound();
  return <ArticlePage locale="ja" article={article} />;
}
