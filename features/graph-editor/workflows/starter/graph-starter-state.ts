"use client";

import { useAtomValue } from "jotai";
import type { RefObject } from "react";
import { useEffect, useMemo, useState } from "react";

import { importGraphInput } from "../../io/import-graph";
import type { ImportFormat, ImportOptions } from "../../io/import-utils";
import type { ImportResult } from "../../io/import-types";
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
      result: importGraphInput(debouncedInputText, importOptions),
    };
  }, [debouncedInputText, importOptions, previewParseKey]);
  const preview = parsedPreview?.result ?? null;

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
    const result =
      parsedPreview?.key === parseKey
        ? parsedPreview.result
        : importGraphInput(text, importOptions);
    setIssues(result.warnings);

    if (!hasGraphContent(result.model)) {
      return;
    }

    applyModel(result.model);
    close();
  };

  const setInput = (value: string) => {
    setInputText(value);
    setIssues([]);
  };

  return {
    applyText,
    close,
    inputText,
    importFormat,
    issues,
    open,
    panelPresence,
    openPaste,
    preview,
    setImportFormat,
    visibleIssues: issues.length > 0 ? issues : (preview?.warnings ?? []),
    setInput,
    setTab,
    tab,
  };
}

type StarterParseResult = {
  key: string;
  result: ImportResult;
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
