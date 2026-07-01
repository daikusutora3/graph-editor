"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";

import { cn } from "@/lib/utils";

import { useGraphCanvasApi } from "../canvas/GraphCanvasProvider";
import type { LayoutKind } from "../layouts";
import { editorModeAtom } from "../shell/state/editor-atoms";
import {
  applyManualLayoutAtom,
  clearGraphAtom,
  setEditorModeAtom,
  updateGraphSettingsAtom,
} from "../shell/state/editor-actions";
import { graphAtom } from "../shell/state/graph-atoms";
import {
  futureAtom,
  historyAtom,
  redoAtom,
  undoAtom,
} from "../shell/state/history-atoms";
import { CompactToolbarLayer } from "./ModeToolbarCompactLayer";
import { ExpandedToolbarLayer } from "./ModeToolbarPanels";

type ModeToolbarProps = {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
};

export function ModeToolbar({
  collapsed: sidebarCollapsed,
  onCollapsedChange,
}: ModeToolbarProps) {
  const toolbar = useModeToolbarState({
    sidebarCollapsed,
    onCollapsedChange,
  });

  return (
    <aside
      ref={toolbar.toolbarRef}
      className={cn(
        "gv-left-sidebar absolute top-[var(--app-space-3)] left-[var(--app-space-3)] z-[70] min-h-0 border border-[var(--divider)] shadow-[var(--app-shadow-card)] backdrop-blur-xl transition-[width,height,border-radius] duration-[var(--app-duration-base)] ease-[var(--app-ease)] motion-reduce:transition-none",
        toolbar.sidebarCollapsed
          ? "overflow-visible rounded-[calc(var(--app-radius-md)+2px)]"
          : "w-[var(--app-toolbar-width)] overflow-hidden rounded-[var(--app-radius-lg)]",
      )}
      style={
        toolbar.toolbarHeight > 0
          ? { height: toolbar.toolbarHeight }
          : undefined
      }
      onScroll={(event) => {
        if (event.currentTarget.scrollTop !== 0) {
          event.currentTarget.scrollTop = 0;
        }
      }}
    >
      <ExpandedToolbarLayer {...toolbar.expandedLayerProps} />

      <CompactToolbarLayer {...toolbar.compactLayerProps} />
    </aside>
  );
}

type UseModeToolbarStateOptions = {
  sidebarCollapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
};

function useModeToolbarState({
  sidebarCollapsed,
  onCollapsedChange,
}: UseModeToolbarStateOptions) {
  const mode = useAtomValue(editorModeAtom);
  const graph = useAtomValue(graphAtom);
  const history = useAtomValue(historyAtom);
  const future = useAtomValue(futureAtom);
  const setMode = useSetAtom(setEditorModeAtom);
  const clearGraph = useSetAtom(clearGraphAtom);
  const applyManualLayout = useSetAtom(applyManualLayoutAtom);
  const updateGraphSettings = useSetAtom(updateGraphSettingsAtom);
  const undo = useSetAtom(undoAtom);
  const redo = useSetAtom(redoAtom);
  const { fitAfterNextGraphRender } = useGraphCanvasApi();
  const toolbarRef = useRef<HTMLElement>(null);
  const expandedToggleRef = useRef<HTMLButtonElement>(null);
  const compactToggleRef = useRef<HTMLButtonElement>(null);
  const [expandedLayerRef, expandedHeight] =
    useMeasuredHeight<HTMLDivElement>();
  const [compactLayerRef, compactHeight] = useMeasuredHeight<HTMLDivElement>();
  const [clearArmed, setClearArmed] = useState(false);
  const [restoreFocusAfterToggle, setRestoreFocusAfterToggle] = useState(false);
  const [showAllLayouts, setShowAllLayouts] = useState(false);
  const isGraphEmpty = graph.nodes.length === 0 && graph.edges.length === 0;
  const isMacShortcutPlatform = useIsMacShortcutPlatform();
  const undoShortcut = isMacShortcutPlatform ? "⌘Z" : "Ctrl+Z";
  const redoShortcut = isMacShortcutPlatform ? "⇧⌘Z" : "Ctrl+Shift+Z";
  const toolbarHeight = sidebarCollapsed ? compactHeight : expandedHeight;
  const clearArmedVisible = clearArmed && !isGraphEmpty;

  const setSidebarCollapsed = (
    nextCollapsed: boolean,
    restoreFocus: boolean,
  ) => {
    const activeElement = document.activeElement;
    const shouldRestoreFocus =
      restoreFocus &&
      activeElement instanceof HTMLElement &&
      (toolbarRef.current?.contains(activeElement) ?? false);

    setRestoreFocusAfterToggle(shouldRestoreFocus);

    if (
      !shouldRestoreFocus &&
      activeElement instanceof HTMLElement &&
      toolbarRef.current?.contains(activeElement)
    ) {
      activeElement.blur();
    }

    onCollapsedChange(nextCollapsed);
  };

  const clearEditor = () => {
    if (isGraphEmpty) {
      setClearArmed(false);
      return;
    }

    if (!clearArmedVisible) {
      setClearArmed(true);
      return;
    }

    clearGraph();
    setClearArmed(false);
  };

  const applyLayout = (kind: LayoutKind) => {
    applyManualLayout(kind);
    fitAfterNextGraphRender();
  };

  const toggleAutoEdgeRouting = () => {
    updateGraphSettings({
      autoEdgeRouting: !graph.settings.autoEdgeRouting,
    });
  };

  useEffect(() => {
    if (!clearArmedVisible) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setClearArmed(false);
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [clearArmedVisible]);

  useEffect(() => {
    if (!restoreFocusAfterToggle) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      const nextButton = sidebarCollapsed
        ? compactToggleRef.current
        : expandedToggleRef.current;

      nextButton?.focus({ preventScroll: true });
      setRestoreFocusAfterToggle(false);
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [restoreFocusAfterToggle, sidebarCollapsed]);

  return {
    sidebarCollapsed,
    toolbarHeight,
    toolbarRef,
    compactLayerProps: {
      clearArmed: clearArmedVisible,
      compactLayerRef,
      compactToggleRef,
      futureDisabled: future.length === 0,
      historyDisabled: history.length === 0,
      isGraphEmpty,
      mode,
      redoShortcut,
      sidebarCollapsed,
      undoShortcut,
      onClearEditor: clearEditor,
      onModeChange: setMode,
      onRedo: redo,
      onToggleCollapsed: setSidebarCollapsed,
      onUndo: undo,
    },
    expandedLayerProps: {
      clearArmed: clearArmedVisible,
      expandedLayerRef,
      expandedToggleRef,
      futureDisabled: future.length === 0,
      graph,
      historyDisabled: history.length === 0,
      isGraphEmpty,
      mode,
      redoShortcut,
      showAllLayouts,
      sidebarCollapsed,
      undoShortcut,
      onApplyLayout: applyLayout,
      onClearEditor: clearEditor,
      onModeChange: setMode,
      onRedo: redo,
      onSetShowAllLayouts: setShowAllLayouts,
      onToggleAutoEdgeRouting: toggleAutoEdgeRouting,
      onToggleCollapsed: setSidebarCollapsed,
      onUndo: undo,
    },
  };
}

function useMeasuredHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const updateHeight = () => {
      setHeight(Math.ceil(element.getBoundingClientRect().height));
    };

    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    window.addEventListener("resize", updateHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  return [ref, height] as const;
}

function useIsMacShortcutPlatform() {
  const [isMac, setIsMac] = useState(false);

  useLayoutEffect(() => {
    setIsMac(
      isMacShortcutPlatformValue(navigator.platform, navigator.userAgent),
    );
  }, []);

  return isMac;
}

export function isMacShortcutPlatformValue(
  platform: string | undefined,
  userAgent: string | undefined,
) {
  const platformText = platform ?? "";
  const userAgentText = userAgent ?? "";

  if (/iPhone|iPad|iPod/i.test(`${platformText} ${userAgentText}`)) {
    return false;
  }

  return /Mac/i.test(platformText || userAgentText);
}
