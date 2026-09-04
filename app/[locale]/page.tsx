import { notFound } from "next/navigation";

import { EditorIntro } from "@/features/graph-editor/shell/EditorIntro";
import { GraphEditor } from "@/features/graph-editor/shell/GraphEditor";
import {
  appRouteLocaleParams,
  getAppLocaleFromParam,
  createAppPageMetadata,
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

  return createAppPageMetadata(getAppLocaleFromParam(locale));
}

export default async function LocalizedHome({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isAppRouteLocaleParam(locale)) {
    notFound();
  }

  const appLocale = getAppLocaleFromParam(locale);

  return (
    <GraphEditor
      initialLocale={appLocale}
      intro={<EditorIntro locale={appLocale} />}
    />
  );
}

function isAppRouteLocaleParam(value: string): value is AppRouteLocaleParam {
  return appRouteLocaleParams.includes(value as AppRouteLocaleParam);
}
