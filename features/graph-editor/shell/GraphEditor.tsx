"use client";

import { useAtomValue } from "jotai";
import { useState } from "react";

import { graphIsEmptyAtom, graphStorageReadyAtom } from "./state/graph-atoms";

import { GraphCanvas } from "../canvas/GraphCanvas";
import { GraphCanvasProvider } from "../canvas/GraphCanvasProvider";
import {
  useGraphEditorShortcuts,
  useGraphExternalStorageSync,
} from "../workflows/editing/graph-editor-hooks";
import { GraphIOControls } from "../ui/GraphIOControls";
import { GraphStarterCard } from "../ui/GraphStarterCard";
import { ModeToolbar } from "../ui/ModeToolbar";
import { I18nProvider } from "../i18n/I18nProvider";
import type { Locale } from "../i18n/locale";

export function GraphEditor({ initialLocale }: { initialLocale?: Locale }) {
  return (
    <I18nProvider initialLocale={initialLocale}>
      <GraphEditorContent />
    </I18nProvider>
  );
}

function GraphEditorContent() {
  const graphIsEmpty = useAtomValue(graphIsEmptyAtom);
  const graphStorageReady = useAtomValue(graphStorageReadyAtom);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useGraphEditorShortcuts();
  useGraphExternalStorageSync();

  return (
    <GraphCanvasProvider>
      <main className="flex h-screen min-h-0 flex-col overflow-hidden bg-[var(--bg)] text-[var(--text)]">
        <div className="relative min-h-0 flex-1">
          <section className="relative h-full min-w-0 bg-[var(--bg-deep)]">
            {graphStorageReady ? (
              <>
                <GraphCanvas sidebarCollapsed={sidebarCollapsed} />
                <ModeToolbar
                  collapsed={sidebarCollapsed}
                  onCollapsedChange={setSidebarCollapsed}
                />
                <GraphStarterCard
                  visible={graphIsEmpty}
                  sidebarCollapsed={sidebarCollapsed}
                />
              </>
            ) : null}
          </section>
        </div>
        {graphStorageReady ? <GraphIOControls /> : null}
      </main>
    </GraphCanvasProvider>
  );
}
