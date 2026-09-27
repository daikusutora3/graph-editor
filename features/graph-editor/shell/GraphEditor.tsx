"use client";

import { useAtomValue } from "jotai";
import { useRef } from "react";

import { editorLayoutAtom } from "./state/editor-atoms";
import { graphStorageReadyAtom } from "./state/graph-atoms";

import dynamic from "next/dynamic";

// Cytoscape is ~40% of the bundle; load it after the shell has painted.
const GraphCanvas = dynamic(
  () => import("../canvas/GraphCanvas").then((module) => module.GraphCanvas),
  { ssr: false },
);
import { GraphCanvasProvider } from "../canvas/GraphCanvasProvider";
import {
  useGraphEditorShortcuts,
  useGraphExternalStorageSync,
} from "../workflows/editing/graph-editor-hooks";
import { useEditorLayoutObserver } from "../ui/chrome/editor-chrome-state";
import { EditorChrome } from "../ui/chrome/EditorChrome";
import { I18nProvider, useI18n } from "../i18n/I18nProvider";
import {
  APP_NAME,
  appGuidePaths,
  appLocaleMetadata,
} from "@/lib/site-metadata";
import type { Locale } from "../i18n/locale";

export function GraphEditor({ initialLocale }: { initialLocale?: Locale }) {
  return (
    <I18nProvider initialLocale={initialLocale}>
      <GraphCanvasProvider>
        <GraphEditorContent />
      </GraphCanvasProvider>
    </I18nProvider>
  );
}

function GraphEditorContent() {
  const { locale, messages } = useI18n();
  const graphStorageReady = useAtomValue(graphStorageReadyAtom);
  const layout = useAtomValue(editorLayoutAtom);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEditorLayoutObserver(rootRef);
  useGraphEditorShortcuts();
  useGraphExternalStorageSync();

  return (
    <main className="flex h-dvh min-h-0 flex-col bg-[var(--bg)] text-[var(--text)]">
      <div
        ref={rootRef}
        data-layout={layout}
        className="@container/editor relative min-h-0 w-full flex-1 overflow-hidden"
      >
        {graphStorageReady ? (
          <>
            <GraphCanvas />
            <EditorChrome />
          </>
        ) : null}
      </div>
      <h1 className="sr-only">{APP_NAME}</h1>
      <footer className="flex min-h-9 flex-none flex-wrap items-center justify-center gap-x-2 border-t border-[var(--hair)] bg-[var(--bg)] px-3 py-1 text-center text-xs text-[var(--text-2)]">
        <span>{appLocaleMetadata[locale].editorIntro}</span>
        <a
          href={appGuidePaths[locale]}
          className="inline-flex min-h-11 items-center rounded px-2 font-semibold text-[var(--text)] underline underline-offset-2 hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-offset-2 md:min-h-0 md:px-0"
        >
          {messages.appMenu.guide}
        </a>
      </footer>
    </main>
  );
}
