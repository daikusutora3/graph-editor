import { notFound } from "next/navigation";

import { GuidePage } from "@/app/guide/GuidePage";
import { guideCopy } from "@/lib/guide-content";
import {
  appRouteLocaleParams,
  createGuidePageMetadata,
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
}) {
  const { locale } = await params;

  if (!isAppRouteLocaleParam(locale)) {
    return {};
  }

  const appLocale = getAppLocaleFromParam(locale);

  return createGuidePageMetadata(appLocale, guideCopy[appLocale]);
}

export default async function LocalizedGuide({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isAppRouteLocaleParam(locale)) {
    notFound();
  }

  return <GuidePage locale={getAppLocaleFromParam(locale)} />;
}

function isAppRouteLocaleParam(value: string): value is AppRouteLocaleParam {
  return appRouteLocaleParams.includes(value as AppRouteLocaleParam);
}
