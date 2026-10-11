import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleIndexPage } from "@/app/articles/ArticleIndexPage";
import { articleCopy } from "@/lib/article-content";
import {
  appRouteLocaleParams,
  createArticleIndexMetadata,
  getAppLocaleFromParam,
  type AppRouteLocaleParam,
} from "@/lib/site-metadata";

export function generateStaticParams() {
  return appRouteLocaleParams.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppRouteLocaleParam(locale)) return {};
  const appLocale = getAppLocaleFromParam(locale);
  return createArticleIndexMetadata(appLocale, articleCopy[appLocale]);
}

export default async function LocalizedArticles({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isAppRouteLocaleParam(locale)) notFound();
  return <ArticleIndexPage locale={getAppLocaleFromParam(locale)} />;
}

function isAppRouteLocaleParam(value: string): value is AppRouteLocaleParam {
  return appRouteLocaleParams.includes(value as AppRouteLocaleParam);
}
