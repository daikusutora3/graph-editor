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
import { useVisualViewport } from "../ui/hooks/use-visual-viewport";
import { useEditorLayoutObserver } from "../ui/chrome/editor-chrome-state";
import { EditorChrome } from "../ui/chrome/EditorChrome";
import { I18nProvider, useI18n } from "../i18n/I18nProvider";
import { APP_NAME, appGuidePaths } from "@/lib/site-metadata";
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
  const viewportRef = useRef<HTMLElement | null>(null);
  useVisualViewport(viewportRef);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEditorLayoutObserver(rootRef);
  useGraphEditorShortcuts();
  useGraphExternalStorageSync();

  return (
    <main
      ref={viewportRef}
      className="fixed inset-x-0 top-[var(--ge-viewport-top,0px)] flex h-[var(--ge-viewport-height,100dvh)] min-h-0 flex-col bg-[var(--bg)] text-[var(--text)]"
    >
      <a
        href={appGuidePaths[locale]}
        className="absolute -top-20 left-3 z-[100] inline-flex min-h-11 items-center rounded-lg border border-[var(--line)] bg-[var(--panel-solid)] px-3 text-sm font-semibold text-[var(--text)] shadow-[var(--shadow)] focus:top-3 focus:outline-2 focus:outline-offset-2"
      >
        {messages.appMenu.guide}
      </a>
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
    </main>
  );
}
