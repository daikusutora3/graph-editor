"use client";
import { CircleAlert, FileInput, FolderOpen } from "lucide-react";
import { lazy, Suspense, type RefObject, useLayoutEffect, useRef } from "react";

import { cn } from "@/lib/utils";

import { useI18n } from "../../i18n/I18nProvider";
import { formatImportWarning } from "../../i18n/import-warning-messages";
import type {
  ImportAnalysis,
  ImportCandidate,
  ImportFormatKind,
} from "../../io/import-types";
import type { ImportFormat } from "../../io/import-utils";

/** One short valid example per format, shown while the paste area is empty. */
const IMPORT_FORMAT_EXAMPLES: Record<ImportFormat, string> = {
  auto: "4 4\n1 2\n2 3\n2 4\n3 4",
  "contest-edge-list": "4 4\n1 2\n2 3\n2 4\n3 4",
  "tree-edge-list": "4\n1 2\n1 3\n3 4",
  "parent-list": "4\n1 1 3",
  "weighted-parent-list": "4\n1 5\n1 3\n3 2",
  "edge-pairs": "1 2\n2 3\n2 4\n3 4",
  "adjacency-list": "1: 2 3\n2: 4\n3: 4",
  "adjacency-matrix": "0 1 1\n1 0 1\n1 1 0",
  json: '{ "version": 1, "nodes": [...], "edges": [...], "settings": {...} }',
};
import type { useGraphStarterState } from "../../workflows/starter/graph-starter-state";
import {
  canApplyStarterInput,
  getStarterInputStatus,
} from "../../workflows/starter/starter-input-status";
import { Button, Select, focusRing, raisedControl } from "../primitives";
import { SAMPLE_GALLERY_GRID_CLASS } from "../samples/sample-gallery-layout";
import { SampleGraphPreview } from "../samples/SampleGraphPreview";

export const loadSampleGalleryPane = () =>
  import("../samples/SampleGalleryPane").then((module) => ({
    default: module.SampleGalleryPane,
  }));

const SampleGalleryPane = lazy(loadSampleGalleryPane);

type StarterState = ReturnType<typeof useGraphStarterState>;

const importFormatOptions: ImportFormatKind[] = [
  "contest-edge-list",
  "tree-edge-list",
  "parent-list",
  "weighted-parent-list",
  "edge-pairs",
  "adjacency-list",
  "adjacency-matrix",
  "json",
];

export function StarterPasteBody({
  starter,
  textareaRef,
}: {
  starter: StarterState;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const { locale, messages } = useI18n();
  const { analysis, importFormat, inputText, preview, visibleIssues } = starter;
  const previewModel = preview?.model;
  const inputStatus = getStarterInputStatus(starter);
  const canApply = canApplyStarterInput(inputStatus);
  const hasIssues =
    visibleIssues.length > 0 ||
    analysis?.status === "ambiguous" ||
    analysis?.status === "invalid" ||
    analysis?.status === "limit";
  const issueSeverity =
    analysis?.status === "invalid" || analysis?.status === "limit"
      ? "error"
      : "warning";
  // Empty input is already announced by the preview pane; keep the header quiet.
  const meta =
    inputStatus === "empty"
      ? ""
      : inputStatus === "reading"
        ? messages.starter.readingFile
        : inputStatus === "checking"
          ? messages.starter.checkingInput
          : canApply && previewModel && !hasIssues
            ? `${messages.chrome.starterMeta(previewModel.nodes.length, previewModel.edges.length)}${
                previewModel.settings.indexBase === 0 ? " · 0-indexed" : ""
              }`
            : hasIssues
              ? messages.starter.needsReview
              : messages.chrome.starterWaiting;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="m-0 min-w-0 flex-1 basis-[220px] text-xs leading-relaxed font-semibold text-[var(--muted)]">
          {messages.chrome.starterHelp}
        </p>
        <div className="flex max-w-full flex-wrap items-center gap-2">
          <Select
            aria-label={messages.starter.formatLabel}
            value={importFormat}
            containerClassName="w-[10.5rem]"
            onChange={(event) =>
              starter.setImportFormat(event.target.value as ImportFormat)
            }
          >
            <option value="auto">{messages.starter.autoFormat}</option>
            {importFormatOptions.map((format) => (
              <option key={format} value={format}>
                {messages.starter.formats[format]}
              </option>
            ))}
          </Select>
          <span
            role="status"
            aria-live="polite"
            className={cn(
              "font-mono text-meta font-semibold whitespace-nowrap",
              hasIssues && inputText.trim()
                ? "text-[var(--danger)]"
                : "text-[var(--muted)]",
            )}
          >
            {meta}
          </span>
        </div>
      </div>
      {starter.fileReadState.status === "failed" ? (
        <p role="alert" className="text-xs text-[var(--danger)]">
          {starter.fileReadState.reason === "too-large"
            ? messages.starter.fileTooLarge(starter.fileReadState.limit)
            : messages.starter.fileReadFailed}
        </p>
      ) : null}
      <div className="ge-paste-grid grid min-h-[352px] flex-1 grid-cols-1 gap-3 sm:min-h-[220px] sm:grid-cols-[minmax(0,1fr)_176px]">
        <textarea
          ref={textareaRef}
          name="graph-input"
          value={inputText}
          aria-label={`${messages.starter.paste}: ${messages.chrome.starterHelp}`}
          placeholder={IMPORT_FORMAT_EXAMPLES[importFormat]}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => starter.setInput(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              if (canApply) {
                starter.applyText();
              }
            }
          }}
          className="ge-focus ge-scrollbar min-h-[220px] w-full resize-none rounded-lg border border-[var(--line)] bg-[var(--fill)] px-3 py-3.5 font-mono text-control leading-[1.5] text-[var(--text)] outline-none placeholder:text-[var(--muted)] @min-[480px]/editor:px-4 @min-[480px]/editor:text-sm @min-[480px]/editor:leading-[1.6]"
        />
        <div
          aria-label={messages.starter.preview}
          className="ge-paste-preview grid min-h-[120px] place-items-center overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--bg)] [background-image:radial-gradient(circle,var(--grid)_1px,transparent_1.4px)] [background-size:16px_16px] sm:min-h-0"
        >
          {canApply && previewModel ? (
            <SampleGraphPreview
              model={previewModel}
              variant="editor"
              width={160}
              height={150}
            />
          ) : (
            <span className="px-3 text-center text-xs font-semibold text-[var(--muted)]">
              {inputStatus === "reading"
                ? messages.starter.readingFile
                : inputStatus === "checking"
                  ? messages.starter.checkingInput
                  : inputStatus === "review"
                    ? messages.starter.needsReview
                    : messages.starter.previewEmpty}
            </span>
          )}
        </div>
      </div>
      {analysis?.status === "ambiguous" ? (
        <AmbiguousFormatChoices
          analysis={analysis}
          onSelect={starter.setImportFormat}
        />
      ) : null}
      {visibleIssues.length > 0 ? (
        <div
          role={issueSeverity === "error" ? "alert" : "status"}
          aria-live={issueSeverity === "error" ? "assertive" : "polite"}
          className={cn(
            "flex flex-col gap-1 text-xs font-medium",
            issueSeverity === "error"
              ? "text-[var(--danger)]"
              : "text-[var(--warning-text)]",
          )}
        >
          {visibleIssues.slice(0, 3).map((issue) => (
            <div
              key={formatImportWarning(issue, locale)}
              className="flex items-center gap-1.5"
            >
              <CircleAlert
                className="size-[13px] shrink-0"
                aria-hidden="true"
              />
              {formatImportWarning(issue, locale)}
            </div>
          ))}
          {visibleIssues.length > 3 ? (
            <div>+{visibleIssues.length - 3}</div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export function StarterPasteFooter({
  starter,
  onUseSample,
}: {
  starter: StarterState;
  onUseSample: () => void;
}) {
  const { messages } = useI18n();
  const inputStatus = getStarterInputStatus(starter);
  const canApply = canApplyStarterInput(inputStatus);
  const actionLabel = {
    empty: messages.chrome.starterApply,
    reading: messages.starter.readingFile,
    checking: messages.starter.checkingInput,
    review: messages.starter.reviewInput,
    ready: messages.chrome.starterApply,
    warning: messages.starter.applyWithWarnings,
  }[inputStatus];

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Switching to samples removes this footer without closing the starter.
  useLayoutEffect(() => starter.cancelFileRead, [starter.cancelFileRead]);

  return (
    <div className="grid w-full min-w-0 grid-cols-2 items-center gap-2 @min-[640px]/editor:flex @min-[640px]/editor:flex-wrap">
      <Button
        size="lg"
        variant="secondary"
        className="h-auto min-h-10 min-w-0 py-2 whitespace-normal touch:min-h-11"
        onClick={onUseSample}
      >
        <span className="min-w-0 whitespace-normal">
          {messages.chrome.starterUseSample}
        </span>
      </Button>
      <Button
        size="lg"
        variant="secondary"
        className="h-auto min-h-10 min-w-0 py-2 whitespace-normal touch:min-h-11 [&>svg]:shrink-0"
        onClick={() => fileInputRef.current?.click()}
      >
        <FolderOpen className="size-icon-sm" aria-hidden="true" />
        <span className="min-w-0 whitespace-normal">
          {messages.chrome.starterOpenFile}
        </span>
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.json,text/plain,application/json"
        hidden
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          void starter.readFile(event.currentTarget.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      <Button
        disabled={!canApply}
        size="lg"
        variant={canApply ? "primary" : "disabled"}
        className="col-span-2 h-auto min-h-10 max-w-full min-w-0 px-4 py-2 whitespace-normal @min-[640px]/editor:ml-auto touch:min-h-11 [&>svg]:shrink-0"
        onClick={() => starter.applyText()}
      >
        <FileInput className="size-icon-sm" aria-hidden="true" />
        <span className="min-w-0 [overflow-wrap:anywhere] whitespace-normal">
          {actionLabel}
        </span>
      </Button>
    </div>
  );
}

export function StarterSampleBody({
  onSampleApplied,
}: {
  onSampleApplied: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Suspense fallback={<SampleGalleryFallback />}>
        <SampleGalleryPane onSampleApplied={onSampleApplied} />
      </Suspense>
    </div>
  );
}

export function StarterSampleFooter({
  onBackToPaste,
}: {
  onBackToPaste: () => void;
}) {
  const { messages } = useI18n();

  return (
    <div className="flex w-full items-center gap-2">
      <Button size="lg" variant="secondary" onClick={onBackToPaste}>
        {messages.chrome.starterBackToPaste}
      </Button>
    </div>
  );
}

function AmbiguousFormatChoices({
  analysis,
  onSelect,
}: {
  analysis: ImportAnalysis;
  onSelect: (format: ImportFormat) => void;
}) {
  const { messages } = useI18n();
  const strongest = analysis.candidates.filter(
    (candidate) => candidate.strength === analysis.candidates[0]?.strength,
  );

  return (
    <fieldset className="min-w-0 rounded-lg border border-[var(--line)] bg-[var(--fill)] px-3 py-3">
      <legend className="px-1 text-control font-semibold text-[var(--text)]">
        {messages.starter.ambiguousTitle}
      </legend>
      <p className="mb-2 text-xs text-[var(--muted)]">
        {messages.starter.ambiguousHelp}
      </p>
      <div className="grid grid-cols-1 gap-2 @min-[640px]/editor:grid-cols-2">
        {strongest.map((candidate) => (
          <AmbiguousFormatChoice
            key={candidate.formatKind}
            candidate={candidate}
            onSelect={onSelect}
          />
        ))}
      </div>
    </fieldset>
  );
}

function AmbiguousFormatChoice({
  candidate,
  onSelect,
}: {
  candidate: ImportCandidate;
  onSelect: (format: ImportFormat) => void;
}) {
  const { messages } = useI18n();

  return (
    <button
      type="button"
      onClick={() => onSelect(candidate.formatKind)}
      className={cn(
        "flex min-h-10 min-w-0 flex-col items-start gap-1 rounded-lg px-3 py-2 text-left text-xs touch:min-h-11",
        raisedControl,
        focusRing,
      )}
    >
      <span className="font-semibold text-[var(--text)]">
        {messages.starter.formats[candidate.formatKind]}
      </span>
      {candidate.nodeCount != null && candidate.edgeCount != null ? (
        <span className="text-[var(--muted)]">
          {messages.starter.previewStats(
            candidate.nodeCount,
            candidate.edgeCount,
          )}
        </span>
      ) : null}
    </button>
  );
}

function SampleGalleryFallback() {
  const { messages } = useI18n();

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-3">
        <div className="ge-skeleton h-9 flex-1 rounded-lg" />
        <div className="ge-skeleton h-4 w-14 rounded-full" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-hidden px-4 pb-4">
        <div className={SAMPLE_GALLERY_GRID_CLASS}>
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="flex flex-col gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel-solid)] p-3"
            >
              <div className="ge-skeleton h-[96px] rounded-lg" />
              <div className="ge-skeleton h-4 w-24 rounded-full" />
              <div className="ge-skeleton h-3 w-32 rounded-full" />
            </div>
          ))}
        </div>
        <span className="sr-only">{messages.starter.loadingSamples}</span>
      </div>
    </div>
  );
}
