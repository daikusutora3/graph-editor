"use client";

import { useAtomValue } from "jotai";
import { useState } from "react";

import { graphAtom, graphStorageReadyAtom } from "./state/graph-atoms";

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

export function GraphEditor() {
  return (
    <I18nProvider>
      <GraphEditorContent />
    </I18nProvider>
  );
}

function GraphEditorContent() {
  const graph = useAtomValue(graphAtom);
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
                <GraphCanvas chrome={{ sidebarCollapsed }} />
                <ModeToolbar
                  collapsed={sidebarCollapsed}
                  onCollapsedChange={setSidebarCollapsed}
                />
                <GraphStarterCard
                  visible={graph.nodes.length === 0 && graph.edges.length === 0}
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
