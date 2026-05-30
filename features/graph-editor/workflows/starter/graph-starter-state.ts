"use client";

import { useAtomValue } from "jotai";
import type { ClipboardEvent, RefObject } from "react";
import { useEffect, useMemo, useState } from "react";

import { importGraphInput } from "../../io/import-graph";
import { hasGraphContent } from "../../core/graph/selectors";
import type { GraphModel } from "../../core/graph/model";
import { graphAtom } from "../../shell/state/graph-atoms";

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
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<StarterTab>("paste");
  const preview = useMemo(() => {
    if (!inputText.trim()) {
      return null;
    }

    return importGraphInput(inputText, graph.settings);
  }, [graph.settings, inputText]);

  const close = () => {
    setOpen(false);
  };

  const openPaste = () => {
    setOpen(true);
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
    if (open && tab === "paste") {
      window.setTimeout(() => textareaRef.current?.focus(), 0);
    }
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
    const result = importGraphInput(text, graph.settings);
    setIssues(result.warnings);

    if (!hasGraphContent(result.model)) {
      return;
    }

    applyModel(result.model);
    close();
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = event.clipboardData.getData("text");

    if (!pastedText.trim()) {
      return;
    }

    event.preventDefault();
    setInputText(pastedText);

    const result = importGraphInput(pastedText, graph.settings);
    setIssues(result.warnings);

    if (result.warnings.length === 0 && result.model.nodes.length > 0) {
      applyModel(result.model);
      close();
    }
  };

  const setInput = (value: string) => {
    setInputText(value);
    setIssues([]);
  };

  return {
    applyText,
    close,
    handlePaste,
    inputText,
    issues,
    open,
    openPaste,
    preview,
    setInput,
    setTab,
    tab,
  };
}
