"use client";

import { useAtomValue } from "jotai";
import type { RefObject } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  evaluateGraphInput,
  MULTIPLE_FORMATS_AMBIGUITY_WARNING,
  WEIGHTED_PARENT_LIST_AMBIGUITY_WARNING,
} from "../../io/import-graph";
import type { ImportFormat, ImportOptions } from "../../io/import-utils";
import type { ImportEvaluation } from "../../io/import-types";
import { hasGraphContent } from "../../core/graph/selectors";
import type { GraphModel } from "../../core/graph/model";
import { graphAtom } from "../../shell/state/graph-atoms";
import { useAnimatedNullableState } from "../../ui/use-panel-presence";
import { useDebouncedValue } from "../../ui/use-debounced-value";

import { useApplyGraphModel } from "./use-apply-graph-model";

export type StarterTab = "paste" | "sample";

type GraphStarterStateOptions = {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
};

export function useGraphStarterState({
  textareaRef,
}: GraphStarterStateOptions) {
  const graph = useAtomValue(graphAtom);
  const applyGraphModel = useApplyGraphModel();
  const [inputText, setInputText] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  const {
    openValue,
    panelPresence,
    setValue: setOpenValue,
  } = useAnimatedNullableState<"starter">();
  const open = openValue !== null;
  const [tab, setTab] = useState<StarterTab>("paste");
  const [importFormat, setImportFormat] = useState<ImportFormat>("auto");
  const importOptions = useMemo<ImportOptions>(
    () => ({
      ...graph.settings,
      format: importFormat,
    }),
    [graph.settings, importFormat],
  );
  const debouncedInputText = useDebouncedValue(inputText, 150);
  const previewParseKey = useMemo(
    () => makeStarterParseKey(debouncedInputText, importOptions),
    [debouncedInputText, importOptions],
  );
  const parsedPreview = useMemo<StarterParseResult | null>(() => {
    if (!debouncedInputText.trim()) {
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
            warning !== MULTIPLE_FORMATS_AMBIGUITY_WARNING &&
            warning !== WEIGHTED_PARENT_LIST_AMBIGUITY_WARNING,
        )
      : (preview?.warnings ?? []);

  const close = () => {
    setOpenValue(null);
  };

  const openPaste = () => {
    setInputText("");
    setIssues([]);
    setImportFormat("auto");
    setOpenValue("starter");
    setTab("paste");
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || tab !== "paste") {
      return;
    }

    const timeoutId = window.setTimeout(() => textareaRef.current?.focus(), 0);

    return () => window.clearTimeout(timeoutId);
  }, [open, tab, textareaRef]);

  const applyModel = (model: GraphModel) => {
    applyGraphModel(model, {
      clearEdgeDraft: true,
      clearSelection: true,
      fitAfterUpdate: true,
      selectMode: true,
    });
  };

  const applyText = (text = inputText) => {
    const parseKey = makeStarterParseKey(text, importOptions);
    const currentEvaluation =
      parsedPreview?.key === parseKey
        ? parsedPreview.evaluation
        : evaluateGraphInput(text, importOptions);
    const { analysis: currentAnalysis, result } = currentEvaluation;
    setIssues(result.warnings);

    if (
      currentAnalysis.status === "ambiguous" ||
      !hasGraphContent(result.model)
    ) {
      return;
    }

    applyModel(result.model);
    close();
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
    panelPresence,
    openPaste,
    preview,
    setImportFormat: selectImportFormat,
    visibleIssues: issues.length > 0 ? issues : previewWarnings,
    setInput,
    setTab,
    tab,
  };
}

type StarterParseResult = {
  key: string;
  evaluation: ImportEvaluation;
};

function makeStarterParseKey(inputText: string, options: ImportOptions) {
  return JSON.stringify({
    inputText,
    settings: {
      allowMultiEdges: options.allowMultiEdges,
      allowSelfLoops: options.allowSelfLoops,
      arrowScale: options.arrowScale,
      autoEdgeRouting: options.autoEdgeRouting,
      directed: options.directed,
      format: options.format,
      indexBase: options.indexBase,
      snapToGrid: options.snapToGrid,
      weighted: options.weighted,
      weightKind: options.weightKind,
    },
  });
}
