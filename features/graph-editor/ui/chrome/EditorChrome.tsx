"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useGraphCanvasApi } from "../../canvas/GraphCanvasProvider";
import type { GraphModel } from "../../core/graph/model";
import {
  copyTextToClipboard,
  downloadBlob,
  formatTimestamp,
} from "../../adapters/browser/file-actions";
import { useI18n } from "../../i18n/I18nProvider";
import {
  exportGraph,
  hasLossyAdjacencyExport,
  type GraphExportFormat,
  getGraphExportFormat,
} from "../../io/export-graph";
import type { LayoutKind } from "../../layouts";
import {
  applyManualLayoutAtom,
  clearGraphAtom,
  reverseAllDirectedEdgesAtom,
  setEditorModeAtom,
  updateGraphSettingsAtom,
} from "../../shell/state/editor-actions";
import {
  editorLayoutAtom,
  editorModeAtom,
} from "../../shell/state/editor-atoms";
import type { EditorMode } from "../../shell/state/editor-state";
import {
  graphAtom,
  graphIsEmptyAtom,
  graphRevisionAtom,
} from "../../shell/state/graph-atoms";
import {
  futureAtom,
  historyAtom,
  redoAtom,
  undoAtom,
} from "../../shell/state/history-atoms";
import { useGraphStarterState } from "../../workflows/starter/graph-starter-state";
import { useApplyGraphModel } from "../../workflows/starter/use-apply-graph-model";
import { useEditorPanel } from "./editor-chrome-state";
import { CanvasHint, Toast } from "./CanvasHint";
import { EditorPanelShell } from "./EditorPanelShell";
import { DesktopTopRow, MobileBottomBar, MobileTopRow } from "./EditorToolbar";
import { EmptyState } from "./EmptyState";
import { useTimedState } from "../hooks/use-timed-state";
import { resetLearnedHints } from "./hint-storage";
import { AppMenuPanel } from "../panels/AppMenuPanel";
import { ExportPanelBody, ExportPanelFooter } from "../panels/ExportPanel";
import type { CopyState } from "../io/graph-io-types";
import { useGraphIOScreenshot } from "../io/graph-io-screenshot";
import { LayoutsPanel } from "../panels/LayoutsPanel";
import { PngPanelBody, PngPanelFooter } from "../panels/PngPanel";
import { SettingsPanel } from "../panels/SettingsPanel";
import {
  formatModifierShortcut,
  useShortcutPlatform,
} from "../hooks/shortcut-platform";
import { ShortcutsPanel } from "../panels/ShortcutsPanel";
import {
  loadSampleGalleryPane,
  StarterPasteBody,
  StarterPasteFooter,
  StarterSampleBody,
  StarterSampleFooter,
} from "../panels/StarterPanel";
import { useThemeMode } from "../theme/theme";

type StarterView = "paste" | "sample";

export function EditorChrome() {
  const { messages } = useI18n();
  const layout = useAtomValue(editorLayoutAtom);
  const mobile = layout === "mobile";
  const wide = layout === "desktop";
  const graph = useAtomValue(graphAtom);
  const graphRevision = useAtomValue(graphRevisionAtom);
  const graphIsEmpty = useAtomValue(graphIsEmptyAtom);
  const mode = useAtomValue(editorModeAtom);
  const history = useAtomValue(historyAtom);
  const future = useAtomValue(futureAtom);
  const setMode = useSetAtom(setEditorModeAtom);
  const undo = useSetAtom(undoAtom);
  const redo = useSetAtom(redoAtom);
  const applyManualLayout = useSetAtom(applyManualLayoutAtom);
  const updateGraphSettings = useSetAtom(updateGraphSettingsAtom);
  const reverseAllDirectedEdges = useSetAtom(reverseAllDirectedEdgesAtom);
  const clearGraph = useSetAtom(clearGraphAtom);
  const { fitAfterNextGraphRender } = useGraphCanvasApi();
  const applyGraphModel = useApplyGraphModel();
  const { close, open, panel, presence, toggle } = useEditorPanel();
  const { theme, setTheme } = useThemeMode();
  const shortcutPlatform = useShortcutPlatform();
  const showShortcutHints = shortcutPlatform !== "touch";
  const undoShortcut = showShortcutHints
    ? formatModifierShortcut(shortcutPlatform, "Z")
    : undefined;
  const redoShortcut = showShortcutHints
    ? formatModifierShortcut(shortcutPlatform, "Z", { shift: true })
    : undefined;

  const [exportFormat, setExportFormat] =
    useState<GraphExportFormat>("edge-list");
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const copyResetRef = useRef<number | null>(null);
  const [clearArmed, setClearArmed] = useTimedState(false, 3000);
  const [toast, setToast] = useTimedState<string | null>(null, 4000);
  const [starterView, setStarterView] = useState<StarterView>("paste");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isGraphEmpty = graphIsEmpty;
  const visiblePanel = presence.value;
  const exportVisible = panel === "export" || visiblePanel === "export";
  const exportText = useMemo(
    () => (exportVisible ? exportGraph(graph, exportFormat) : ""),
    [exportFormat, exportVisible, graph],
  );
  const screenshot = useGraphIOScreenshot({
    graphRevision,
    isGraphEmpty,
    previewEnabled: panel === "png" || visiblePanel === "png",
    theme,
  });
  const starter = useGraphStarterState({
    open: panel === "starter",
    onClose: close,
    textareaRef,
  });

  useEffect(() => {
    if (panel !== "starter" || starterView !== "paste") {
      return;
    }

    const timeoutId = window.setTimeout(() => textareaRef.current?.focus(), 0);

    return () => window.clearTimeout(timeoutId);
  }, [panel, starterView]);

  useEffect(() => {
    if (panel === "starter") {
      void loadSampleGalleryPane();
    }
  }, [panel]);

  useEffect(() => {
    if (panel !== "settings" && panel !== "menu") {
      setClearArmed(false);
    }

    if (panel !== "export") {
      setCopyState("idle");
    }
  }, [panel, setClearArmed]);

  useEffect(
    () => () => {
      if (copyResetRef.current !== null) {
        window.clearTimeout(copyResetRef.current);
      }
    },
    [],
  );

  const handleModeChange = useCallback(
    (nextMode: EditorMode) => {
      setMode(nextMode);

      if (nextMode !== "select" || panel === "starter") {
        close();
      }
    },
    [close, panel, setMode],
  );

  const openStarter = useCallback(
    (view: StarterView) => {
      setStarterView(view);
      open("starter");
    },
    [open],
  );

  const applyLayout = useCallback(
    (kind: LayoutKind) => {
      applyManualLayout(kind);
      fitAfterNextGraphRender();

      // A bottom sheet hides most of the canvas, so on mobile the result
      // would be invisible until the sheet is dismissed.
      if (mobile) {
        close();
      }
    },
    [applyManualLayout, close, fitAfterNextGraphRender, mobile],
  );

  const toggleOffsetEdges = useCallback(() => {
    updateGraphSettings({ autoEdgeRouting: !graph.settings.autoEdgeRouting });
  }, [graph.settings.autoEdgeRouting, updateGraphSettings]);

  const handleClear = useCallback(() => {
    if (isGraphEmpty) {
      setClearArmed(false);
      return;
    }

    if (!clearArmed) {
      setClearArmed(true);
      return;
    }

    clearGraph();
    setClearArmed(false);
    close();
    setToast(messages.chrome.clearedToast(undoShortcut ?? "Ctrl+Z"));
  }, [
    clearArmed,
    clearGraph,
    close,
    isGraphEmpty,
    messages.chrome,
    setClearArmed,
    setToast,
    undoShortcut,
  ]);

  const copyExport = useCallback(async () => {
    const copied = await copyTextToClipboard(exportGraph(graph, exportFormat));
    setCopyState(copied ? "copied" : "blocked");

    if (copyResetRef.current !== null) {
      window.clearTimeout(copyResetRef.current);
    }

    copyResetRef.current = window.setTimeout(() => setCopyState("idle"), 1500);
  }, [exportFormat, graph]);

  const saveExportTxt = useCallback(() => {
    const { extension, mimeType } = getGraphExportFormat(exportFormat);

    downloadBlob(
      new Blob([exportGraph(graph, exportFormat)], { type: mimeType }),
      `graph-editor-${formatTimestamp(new Date())}.${extension}`,
    );
  }, [exportFormat, graph]);

  const loadSampleModel = useCallback(
    (model: GraphModel) => {
      applyGraphModel(model, {
        clearEdgeDraft: true,
        clearSelection: true,
        fitAfterUpdate: true,
        selectMode: true,
      });
      close();
    },
    [applyGraphModel, close],
  );

  const nodeEdgeMeta = `N=${graph.nodes.length} M=${graph.edges.length}`;
  const toolbarProps = {
    canRedo: future.length > 0,
    canUndo: history.length > 0,
    mode,
    panel,
    redoShortcut,
    undoShortcut,
    onModeChange: handleModeChange,
    onRedo: redo,
    onTogglePanel: toggle,
    onUndo: undo,
  };

  const renderPanel = () => {
    if (!visiblePanel) {
      return null;
    }

    const shellProps = {
      layout,
      onClose: close,
      panel: visiblePanel,
      state: presence.state,
    };

    switch (visiblePanel) {
      case "app":
        return (
          <EditorPanelShell {...shellProps} title={messages.appMenu.label}>
            <AppMenuPanel onOpenShortcuts={() => open("shortcuts")} />
          </EditorPanelShell>
        );
      case "layouts":
        return (
          <EditorPanelShell {...shellProps} title={messages.chrome.layouts}>
            <LayoutsPanel
              graph={graph}
              onApplyLayout={applyLayout}
              onToggleOffsetEdges={toggleOffsetEdges}
            />
          </EditorPanelShell>
        );
      case "settings":
        return (
          <EditorPanelShell {...shellProps} title={messages.chrome.settings}>
            <SettingsPanel
              clearArmed={clearArmed}
              graph={graph}
              mobile={mobile}
              onClear={handleClear}
              onResetHints={resetLearnedHints}
              onReverseAllEdges={() => reverseAllDirectedEdges()}
              onUpdateSettings={updateGraphSettings}
            />
          </EditorPanelShell>
        );
      case "menu":
        return (
          <EditorPanelShell {...shellProps} title={messages.chrome.menu}>
            <LayoutsPanel
              graph={graph}
              showTitle
              onApplyLayout={applyLayout}
              onToggleOffsetEdges={toggleOffsetEdges}
            />
            <SettingsPanel
              clearArmed={clearArmed}
              graph={graph}
              mobile={mobile}
              onClear={handleClear}
              onResetHints={resetLearnedHints}
              onReverseAllEdges={() => reverseAllDirectedEdges()}
              onUpdateSettings={updateGraphSettings}
            />
          </EditorPanelShell>
        );
      case "export":
        return (
          <EditorPanelShell
            {...shellProps}
            meta={nodeEdgeMeta}
            title={messages.chrome.export}
            footer={
              <ExportPanelFooter
                copyState={copyState}
                disabled={!exportText}
                extension={getGraphExportFormat(exportFormat).extension}
                onCopy={() => void copyExport()}
                onSaveTxt={saveExportTxt}
              />
            }
          >
            <ExportPanelBody
              exportFormat={exportFormat}
              exportText={exportText}
              exportWarning={
                hasLossyAdjacencyExport(graph, exportFormat)
                  ? messages.exportPanel.adjacencyLossWarning
                  : undefined
              }
              mobile={mobile}
              onExportFormatChange={(format) => {
                setExportFormat(format);
                setCopyState("idle");
              }}
            />
          </EditorPanelShell>
        );
      case "png":
        return (
          <EditorPanelShell
            {...shellProps}
            meta={nodeEdgeMeta}
            title={messages.chrome.png}
            footer={
              <PngPanelFooter
                copyState={screenshot.copyState}
                downloadState={screenshot.downloadState}
                isGraphEmpty={isGraphEmpty}
                onCopy={screenshot.copy}
                onDownload={screenshot.download}
              />
            }
          >
            <PngPanelBody
              background={screenshot.effectiveBackground}
              longEdgePx={
                screenshot.longEdgePreset === "custom"
                  ? screenshot.customLongEdgePx
                  : screenshot.longEdgePreset
              }
              mobile={mobile}
              notice={screenshot.copyMessage || screenshot.downloadMessage}
              paddingPx={
                screenshot.paddingPreset === "custom"
                  ? screenshot.customPaddingPx
                  : screenshot.paddingPreset
              }
              preview={screenshot.preview}
              scope={screenshot.scope}
              solidBackground={screenshot.solidBackground}
              theme={theme}
              onBackgroundChange={screenshot.setBackground}
              onLongEdgeChange={screenshot.setCustomLongEdgePx}
              onPaddingChange={screenshot.setCustomPaddingPx}
              onScopeChange={screenshot.setScope}
            />
          </EditorPanelShell>
        );
      case "starter":
        return starterView === "paste" ? (
          <EditorPanelShell
            {...shellProps}
            title={messages.chrome.starterTitle}
            footer={
              <StarterPasteFooter
                starter={starter}
                onUseSample={() => setStarterView("sample")}
              />
            }
          >
            <StarterPasteBody starter={starter} textareaRef={textareaRef} />
          </EditorPanelShell>
        ) : (
          <EditorPanelShell
            {...shellProps}
            bodyClassName="gap-0"
            title={messages.chrome.starterSamplesTitle}
            width={680}
            footer={
              <StarterSampleFooter
                onBackToPaste={() => setStarterView("paste")}
              />
            }
          >
            <StarterSampleBody onSampleApplied={close} />
          </EditorPanelShell>
        );
      case "shortcuts":
        return (
          <EditorPanelShell {...shellProps} title={messages.chrome.shortcuts}>
            <ShortcutsPanel platform={shortcutPlatform} />
          </EditorPanelShell>
        );
    }
  };

  return (
    <>
      {graphIsEmpty && !visiblePanel && mode === "select" ? (
        <EmptyState
          graph={graph}
          mobile={mobile}
          onDraw={() => handleModeChange("node")}
          onLoadSample={loadSampleModel}
          onOpenPaste={() => openStarter("paste")}
          onOpenSamples={() => openStarter("sample")}
        />
      ) : null}

      {mobile ? (
        <>
          <MobileTopRow
            panel={panel}
            theme={theme}
            onOpenStarter={() => openStarter("paste")}
            onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
            onTogglePanel={toggle}
          />
          <MobileBottomBar {...toolbarProps} />
        </>
      ) : (
        <DesktopTopRow
          {...toolbarProps}
          theme={theme}
          wide={wide}
          onOpenStarter={() => openStarter("paste")}
          onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
        />
      )}

      <CanvasHint mobile={mobile} visible={!visiblePanel} />
      <Toast message={toast} mobile={mobile} />

      {renderPanel()}
    </>
  );
}
