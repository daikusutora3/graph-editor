import type { ReactNode } from "react";

import { appRootMetadata, appViewport } from "@/lib/site-metadata";

import { LocaleRootLayout } from "../LocaleRootLayout";
import "../globals.css";

export const metadata = appRootMetadata;
export const viewport = appViewport;

export default function JapaneseRootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <LocaleRootLayout locale="ja">{children}</LocaleRootLayout>;
}
