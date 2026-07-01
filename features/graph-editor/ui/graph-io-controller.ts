"use client";

import { useAtomValue } from "jotai";
import type { MutableRefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { exportGraph, type GraphExportFormat } from "../io/export-graph";
import { graphAtom } from "../shell/state/graph-atoms";

import { copyTextToClipboard } from "../adapters/browser/file-actions";
import { useGraphIODropdown } from "./graph-io-dropdown";
import { useGraphIOScreenshot } from "./graph-io-screenshot";
import type { CopyState } from "./graph-io-types";
import { type ThemeMode, useThemeMode } from "./theme";

export function useGraphIOController() {
  const graph = useAtomValue(graphAtom);
  const { theme, setTheme } = useThemeMode();
  const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";
  const [exportFormat, setExportFormat] =
    useState<GraphExportFormat>("edge-list");
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [railWidth, setRailWidth] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const copyResetTimeoutRef = useRef<number | null>(null);
  const { exportOpen, panelPresence, screenshotOpen, setOpenPanel } =
    useGraphIODropdown({
      panelRef,
      railRef,
    });

  const isGraphEmpty = graph.nodes.length === 0;
  const screenshot = useGraphIOScreenshot({
    graph,
    isGraphEmpty,
    previewEnabled: screenshotOpen || panelPresence.value === "screenshot",
    theme,
  });
  const exportText = useMemo(
    () =>
      exportOpen || panelPresence.value === "export"
        ? exportGraph(graph, exportFormat)
        : "",
    [exportFormat, exportOpen, graph, panelPresence.value],
  );
  const panelRight =
    railWidth > 0
      ? `calc(var(--app-space-3) + ${railWidth}px + var(--app-space-2))`
      : undefined;

  const openExportPanel = () => {
    setOpenPanel(exportOpen ? null : "export");
    setCopyState("idle");
  };

  const openScreenshotPanel = () => {
    if (screenshotOpen) {
      setOpenPanel(null);
      return;
    }

    setOpenPanel("screenshot");
    void screenshot.refreshPreview();
  };

  const copyExport = async () => {
    const copied = await copyTextToClipboard(exportGraph(graph, exportFormat));

    setCopyState(copied ? "copied" : "blocked");
    scheduleCopyReset(copyResetTimeoutRef, setCopyState);
  };

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const updateRailWidth = () => {
      setRailWidth(rail.getBoundingClientRect().width);
    };

    updateRailWidth();

    const observer = new ResizeObserver(updateRailWidth);
    observer.observe(rail);
    return () => observer.disconnect();
  }, []);

  useEffect(
    () => () => {
      clearTimeoutRef(copyResetTimeoutRef);
    },
    [],
  );

  return {
    copyState,
    exportFormat,
    exportOpen,
    exportText,
    graph,
    isGraphEmpty,
    nextTheme,
    panelRef,
    panelPresence,
    panelRight,
    railRef,
    screenshot,
    screenshotOpen,
    setExportFormat,
    setOpenPanel,
    setTheme,
    theme,
    actions: {
      copyExport,
      openExportPanel,
      openScreenshotPanel,
    },
  };
}

function scheduleCopyReset(
  ref: MutableRefObject<number | null>,
  setCopyState: (state: CopyState) => void,
) {
  clearTimeoutRef(ref);
  ref.current = window.setTimeout(() => setCopyState("idle"), 2400);
}

function clearTimeoutRef(ref: MutableRefObject<number | null>) {
  if (ref.current === null) {
    return;
  }

  window.clearTimeout(ref.current);
  ref.current = null;
}
