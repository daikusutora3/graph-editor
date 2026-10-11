"use client";

import { ArrowLeft, BookOpen } from "lucide-react";
import { getGraphStorageContext } from "../../adapters/browser/graph-storage-context";
import { useI18n } from "../../i18n/I18nProvider";
import { appArticlePaths, appLocalePaths } from "@/lib/site-metadata";
import { contentNavigationCopy } from "@/lib/content-navigation";
import { actionStyles } from "@/components/ui/styles";

/** Mounted after storage hydration, so browser-only example URLs cannot affect SSR. */
export function ExampleSessionBanner() {
  const { locale } = useI18n();
  const context = getGraphStorageContext();
  if (context.kind !== "example") return null;
  const copy = contentNavigationCopy[locale];
  return (
    <aside className="shrink-0 border-b border-[var(--line)] bg-[var(--panel-solid)] px-3 py-2 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--text)]">
            {copy.example} · {copy.titles[context.slug]}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-2)]">
            {copy.exampleNote}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <a
            href={`${appArticlePaths[locale]}/${context.slug}`}
            className={`${actionStyles()} text-xs`}
          >
            <BookOpen className="size-4 shrink-0" aria-hidden="true" />
            {copy.sourceArticle}
          </a>
          <a
            href={appLocalePaths[locale]}
            className={`${actionStyles("soft")} text-xs`}
          >
            <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
            {copy.original}
          </a>
        </div>
      </div>
    </aside>
  );
}
