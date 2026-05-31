"use client";

import { useAtomValue } from "jotai";
import type { RefObject } from "react";
import { useEffect, useMemo, useState } from "react";

import { importGraphInput } from "../../io/import-graph";
import type { ImportFormat } from "../../io/import-utils";
import { hasGraphContent } from "../../core/graph/selectors";
import type { GraphModel } from "../../core/graph/model";
import { graphAtom } from "../../shell/state/graph-atoms";
import { useAnimatedNullableState } from "../../ui/use-panel-presence";

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
  const [importFormat, setImportFormat] = useState<ImportFormat>("auto");
  const {
    openValue,
    panelPresence,
    setValue: setOpenValue,
  } = useAnimatedNullableState<"starter">();
  const open = openValue !== null;
  const [tab, setTab] = useState<StarterTab>("paste");
  const preview = useMemo(() => {
    if (!inputText.trim()) {
      return null;
    }

    return importGraphInput(inputText, {
      ...graph.settings,
      format: importFormat,
    });
  }, [graph.settings, importFormat, inputText]);

  const close = () => {
    setOpenValue(null);
  };

  const openPaste = () => {
    setInputText("");
    setIssues([]);
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
    const result = importGraphInput(text, {
      ...graph.settings,
      format: importFormat,
    });
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
    importFormat,
    inputText,
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
