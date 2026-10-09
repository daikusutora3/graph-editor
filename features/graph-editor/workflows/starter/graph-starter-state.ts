"use client";

import type { ImportWarning } from "../../io/import-types";
import { useAtomValue } from "jotai";
import type { RefObject } from "react";
import { useEffect, useMemo, useState } from "react";

import { evaluateGraphInput } from "../../io/import-graph";
import { initializeRustKernel } from "../../compute/rust-kernel";
import type { ImportFormat, ImportOptions } from "../../io/import-utils";
import type { ImportEvaluation } from "../../io/import-types";
import type { GraphModel } from "../../core/graph/model";
import { graphSettingsAtom } from "../../shell/state/graph-atoms";
import { useDebouncedValue } from "../../ui/hooks/use-debounced-value";

import { useApplyGraphModel } from "./use-apply-graph-model";

export type StarterTab = "paste" | "sample";

type GraphStarterStateOptions = {
  open: boolean;
  /** Keep enabled through the paste panel's closing animation. */
  previewEnabled?: boolean;
  onClose: () => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
};

export function useGraphStarterState({
  open,
  previewEnabled = true,
  onClose,
  textareaRef,
}: GraphStarterStateOptions) {
  const graphSettings = useAtomValue(graphSettingsAtom);
  const applyGraphModel = useApplyGraphModel();
  const [inputText, setInputText] = useState("");
  const [issues, setIssues] = useState<ImportWarning[]>([]);
  const [tab, setTab] = useState<StarterTab>("paste");
  const [importFormat, setImportFormat] = useState<ImportFormat>("auto");
  const importOptions = useMemo<ImportOptions>(
    () => ({
      ...graphSettings,
      format: importFormat,
    }),
    [graphSettings, importFormat],
  );
  const debouncedInputText = useDebouncedValue(inputText, 150, {
    transition: true,
  });
  useEffect(() => {
    // A fresh empty canvas has not loaded the kernel yet. Start its download
    // during the input debounce for large pastes; parsing keeps the JS fallback.
    if (open && tab === "paste" && inputText.length >= 16_384)
      void initializeRustKernel().catch(() => {});
  }, [inputText, open, tab]);
  const previewParseKey = useMemo(
    () =>
      previewEnabled
        ? makeStarterParseKey(debouncedInputText, importOptions)
        : null,
    [debouncedInputText, importOptions, previewEnabled],
  );
  const parsedPreview = useMemo<StarterParseResult | null>(() => {
    if (previewParseKey === null || !debouncedInputText.trim()) {
      return null;
    }

    return {
      key: previewParseKey,
      evaluation: evaluateGraphInput(debouncedInputText, importOptions),
    };
  }, [debouncedInputText, importOptions, previewParseKey]);
  const evaluation = parsedPreview?.evaluation ?? null;
  const preview = evaluation?.result ?? null;
  const analysis = evaluation?.analysis ?? null;
  const previewWarnings =
    analysis?.status === "ambiguous"
      ? (preview?.warnings ?? []).filter(
          (warning) =>
            warning.code !== "ambiguous-formats" &&
            warning.code !== "maybe-weighted-parent-list",
        )
      : (preview?.warnings ?? []);

  const close = () => {
    onClose();
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    setInputText("");
    setIssues([]);
    setImportFormat("auto");
  }, [open]);

  useEffect(() => {
    if (!open || tab !== "paste") {
      return;
    }

    const timeoutId = window.setTimeout(() => textareaRef.current?.focus(), 0);

    return () => window.clearTimeout(timeoutId);
  }, [open, tab, textareaRef]);

  const applyModel = (model: GraphModel) => {
    return applyGraphModel(model, {
      clearEdgeDraft: true,
      clearSelection: true,
      fitAfterUpdate: true,
      selectMode: true,
    });
  };

  const applyText = (text = inputText) => {
    const parseKey = makeStarterParseKey(text, importOptions);
    const currentEvaluation =
      parsedPreview?.key.inputText === parseKey.inputText &&
      parsedPreview.key.settings === parseKey.settings
        ? parsedPreview.evaluation
        : evaluateGraphInput(text, importOptions);
    const { analysis: currentAnalysis, result } = currentEvaluation;
    setIssues(result.warnings);

    if (
      currentAnalysis.status === "ambiguous" ||
      currentAnalysis.status !== "detected"
    ) {
      return;
    }

    if (applyModel(result.model)) close();
  };

  const setInput = (value: string) => {
    setInputText(value);
    setIssues([]);
  };

  const selectImportFormat = (value: ImportFormat) => {
    setImportFormat(value);
    setIssues([]);
  };

  return {
    applyText,
    analysis,
    close,
    inputText,
    importFormat,
    issues,
    open,
    preview,
    setImportFormat: selectImportFormat,
    visibleIssues: issues.length > 0 ? issues : previewWarnings,
    setInput,
    setTab,
    tab,
  };
}

type StarterParseResult = {
  key: ReturnType<typeof makeStarterParseKey>;
  evaluation: ImportEvaluation;
};

function makeStarterParseKey(inputText: string, options: ImportOptions) {
  return {
    inputText,
    settings: JSON.stringify({
      allowMultiEdges: options.allowMultiEdges,
      allowSelfLoops: options.allowSelfLoops,
      arrowScale: options.arrowScale,
      autoEdgeRouting: options.autoEdgeRouting,
      directed: options.directed,
      format: options.format,
      indexBase: options.indexBase,
      snapToGrid: options.snapToGrid,
      showNodeLabels: options.showNodeLabels,
      weighted: options.weighted,
      weightKind: options.weightKind,
    } satisfies Record<keyof ImportOptions, unknown>),
  };
}
