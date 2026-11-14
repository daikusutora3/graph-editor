"use client";

import type { ImportWarning } from "../../io/import-types";
import { useAtomValue } from "jotai";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { evaluateGraphInput } from "../../io/import-graph";
import { getImportExample } from "../../io/import-examples";
import { initializeRustKernel } from "../../compute/rust-kernel";
import type { ImportFormat, ImportOptions } from "../../io/import-utils";
import type { ImportEvaluation } from "../../io/import-types";
import { graphSettingsAtom } from "../../shell/state/graph-atoms";
import { useDebouncedValue } from "../../ui/hooks/use-debounced-value";

import { useApplyGraphModel } from "./use-apply-graph-model";
import {
  createStarterFileReader,
  IDLE_FILE_READ_STATE,
  type StarterFileReadState,
} from "./starter-file-read";

type GraphStarterStateOptions = {
  open: boolean;

  previewEnabled: boolean;
  onClose: () => void;
};

export function useGraphStarterState({
  open,
  previewEnabled,
  onClose,
}: GraphStarterStateOptions) {
  const graphSettings = useAtomValue(graphSettingsAtom);
  const applyGraphModel = useApplyGraphModel();
  const [inputText, setInputText] = useState("");
  const [issues, setIssues] = useState<ImportWarning[]>([]);
  const [importFormat, setImportFormat] = useState<ImportFormat>("auto");
  const importFormatRef = useRef(importFormat);
  const [fileReadState, setFileReadState] =
    useState<StarterFileReadState>(IDLE_FILE_READ_STATE);
  const fileReaderRef = useRef<ReturnType<
    typeof createStarterFileReader
  > | null>(null);
  if (!fileReaderRef.current) {
    fileReaderRef.current = createStarterFileReader({
      getFormat: () => importFormatRef.current,
      onInput: (text) => {
        setInputText(text);
        setIssues([]);
      },
      onState: setFileReadState,
    });
  }
  const fileReader = fileReaderRef.current;
  const cancelFileRead = useCallback(
    () => fileReader.invalidate(),
    [fileReader],
  );
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
    if (open && inputText.length >= 16_384)
      void initializeRustKernel().catch(() => {});
  }, [inputText, open]);
  const parsedPreview = useMemo<StarterParseResult | null>(() => {
    if (!previewEnabled || !debouncedInputText.trim()) return null;

    return {
      inputText: debouncedInputText,
      evaluation: evaluateGraphInput(debouncedInputText, importOptions),
    };
  }, [debouncedInputText, importOptions, previewEnabled]);

  const previewPending =
    previewEnabled &&
    Boolean(inputText.trim()) &&
    parsedPreview?.inputText !== inputText;
  const evaluation =
    parsedPreview?.inputText === inputText ? parsedPreview.evaluation : null;
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
    cancelFileRead();
    onClose();
  };

  useLayoutEffect(() => {
    cancelFileRead();
    if (!open) {
      return cancelFileRead;
    }

    setInputText("");
    setIssues([]);
    setImportFormat("auto");
    importFormatRef.current = "auto";
    return cancelFileRead;
  }, [cancelFileRead, open]);

  const applyText = (text = inputText) => {
    const currentEvaluation =
      parsedPreview?.inputText === text
        ? parsedPreview.evaluation
        : evaluateGraphInput(text, importOptions);
    const { analysis: currentAnalysis, result } = currentEvaluation;
    setIssues(result.warnings);

    if (currentAnalysis.status !== "detected" || result.status === "failure") {
      return;
    }

    if (applyGraphModel(result.model)) close();
  };

  const setInput = (value: string) => {
    cancelFileRead();
    setInputText(value);
    setIssues([]);
  };

  const selectImportFormat = (value: ImportFormat) => {
    importFormatRef.current = value;
    setImportFormat(value);
    setIssues([]);
  };

  return {
    inputExample: getImportExample(importFormat, graphSettings.indexBase),
    applyText,
    analysis,
    close,
    cancelFileRead,
    fileReadState,
    readFile: fileReader.read,
    inputText,
    importFormat,
    preview,
    previewPending,
    setImportFormat: selectImportFormat,
    visibleIssues: issues.length > 0 ? issues : previewWarnings,
    setInput,
  };
}

type StarterParseResult = {
  inputText: string;
  evaluation: ImportEvaluation;
};
