"use client";

import { useAtomValue } from "jotai";
import { useRef } from "react";

import { editorLayoutAtom } from "./state/editor-atoms";
import { graphStorageReadyAtom } from "./state/graph-atoms";

import { GraphCanvas } from "../canvas/GraphCanvas";
import { GraphCanvasProvider } from "../canvas/GraphCanvasProvider";
import {
  useGraphEditorShortcuts,
  useGraphExternalStorageSync,
} from "../workflows/editing/graph-editor-hooks";
import { useEditorLayoutObserver } from "../ui/chrome/editor-chrome-state";
import { EditorChrome } from "../ui/chrome/EditorChrome";
import { I18nProvider } from "../i18n/I18nProvider";
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
  const graphStorageReady = useAtomValue(graphStorageReadyAtom);
  const layout = useAtomValue(editorLayoutAtom);
  const rootRef = useRef<HTMLElement | null>(null);

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
          <GraphCanvas />
          <EditorChrome />
        </>
      ) : null}
    </main>
  );
}
