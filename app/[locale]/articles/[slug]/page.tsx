import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticlePage } from "@/app/articles/ArticlePage";
import { articleSlugs, getArticle } from "@/lib/article-content";
import {
  appRouteLocaleParams,
  createArticlePageMetadata,
  getAppLocaleFromParam,
  type AppRouteLocaleParam,
} from "@/lib/site-metadata";

export const dynamicParams = false;

export function generateStaticParams() {
  return appRouteLocaleParams.flatMap((locale) =>
    articleSlugs.map((slug) => ({ locale, slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isAppRouteLocaleParam(locale)) return {};
  const appLocale = getAppLocaleFromParam(locale);
  const article = getArticle(appLocale, slug);
  return article ? createArticlePageMetadata(appLocale, article) : {};
}

export default async function LocalizedArticle({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isAppRouteLocaleParam(locale)) notFound();
  const appLocale = getAppLocaleFromParam(locale);
  const article = getArticle(appLocale, slug);
  if (!article) notFound();
  return <ArticlePage locale={appLocale} article={article} />;
}

function isAppRouteLocaleParam(value: string): value is AppRouteLocaleParam {
  return appRouteLocaleParams.includes(value as AppRouteLocaleParam);
}
