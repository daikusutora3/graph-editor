import type { ReactNode } from "react";

import {
  appRootMetadata,
  appViewport,
  getAppLocaleFromParam,
} from "@/lib/site-metadata";

import { LocaleRootLayout } from "../LocaleRootLayout";
import "../globals.css";

export const dynamicParams = false;
export const metadata = appRootMetadata;
export const viewport = appViewport;

export default async function LocalizedRootLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <LocaleRootLayout locale={getAppLocaleFromParam(locale)}>
      {children}
    </LocaleRootLayout>
  );
}
