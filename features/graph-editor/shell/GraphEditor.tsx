"use client";

import { useAtomValue } from "jotai";
import { useRef, type ReactNode } from "react";

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
import type { Locale } from "../i18n/locale";

export function GraphEditor({
  initialLocale,
  intro,
}: {
  initialLocale?: Locale;
  /** Server-rendered content shown until the editor mounts (indexed by crawlers). */
  intro?: ReactNode;
}) {
  return (
    <I18nProvider initialLocale={initialLocale}>
      <GraphCanvasProvider>
        <GraphEditorContent intro={intro} />
      </GraphCanvasProvider>
    </I18nProvider>
  );
}

function GraphEditorContent({ intro }: { intro?: ReactNode }) {
  const graphStorageReady = useAtomValue(graphStorageReadyAtom);
  const layout = useAtomValue(editorLayoutAtom);
  const rootRef = useRef<HTMLElement | null>(null);
  const { messages } = useI18n();

  useEditorLayoutObserver(rootRef);
  useGraphEditorShortcuts();
  useGraphExternalStorageSync();

  return (
    <main
      ref={rootRef}
      data-layout={layout}
      className="@container/editor relative h-dvh min-h-0 w-full overflow-hidden bg-[var(--bg)] text-[var(--text)]"
    >
      {graphStorageReady ? (
        <>
          {/* Keeps a document heading once the intro is replaced. */}
          <h1 className="sr-only">{messages.app.title}</h1>
          <GraphCanvas />
          <EditorChrome />
        </>
      ) : (
        intro
      )}
    </main>
  );
}
