import type { ReactNode } from "react";

import { appRootMetadata } from "@/lib/site-metadata";

import { LocaleRootLayout } from "../LocaleRootLayout";
import "../globals.css";

export const metadata = appRootMetadata;

export default function JapaneseRootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <LocaleRootLayout locale="ja">{children}</LocaleRootLayout>;
}
