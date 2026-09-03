"use client";

import { CircleAlert, FileInput } from "lucide-react";
import { lazy, Suspense, type RefObject } from "react";

import { cn } from "@/lib/utils";

import { useI18n } from "../../i18n/I18nProvider";
import { formatImportWarning } from "../../i18n/import-warning-messages";
import type {
  ImportAnalysis,
  ImportCandidate,
  ImportFormatKind,
} from "../../io/import-types";
import type { ImportFormat } from "../../io/import-utils";
import type { useGraphStarterState } from "../../workflows/starter/graph-starter-state";
import { Button, Select, focusRing, raisedControl } from "../primitives";
import { SAMPLE_GALLERY_GRID_CLASS } from "../samples/SampleGalleryPane";
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
];

function canApplyStarter(starter: StarterState) {
  const previewModel = starter.preview?.model;

  return (
    Boolean(starter.inputText.trim()) &&
    starter.analysis?.status === "detected" &&
    Boolean(
      previewModel &&
      (previewModel.nodes.length > 0 || previewModel.edges.length > 0),
    )
  );
}

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
  const canApply = canApplyStarter(starter);
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
  const meta = !inputText.trim()
    ? ""
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
        <p className="m-0 min-w-[220px] flex-1 text-xs leading-relaxed font-semibold text-[var(--muted)]">
          {messages.chrome.starterHelp}
        </p>
        <div className="flex items-center gap-2">
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
              "font-mono text-[11px] font-semibold whitespace-nowrap",
              hasIssues && inputText.trim()
                ? "text-[var(--danger)]"
                : "text-[var(--muted)]",
            )}
          >
            {meta}
          </span>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_176px]">
        <textarea
          ref={textareaRef}
          name="graph-input"
          value={inputText}
          aria-label={`${messages.starter.paste}: ${messages.chrome.starterHelp}`}
          autoComplete="off"
          spellCheck={false}
          placeholder={"4 4\n1 2\n2 3\n2 4\n3 4"}
          onChange={(event) => starter.setInput(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              if (canApply) {
                starter.applyText();
              }
            }
          }}
          className="ge-focus ge-scrollbar min-h-[220px] w-full resize-none rounded-lg border border-[var(--line)] bg-[var(--fill)] px-4 py-3.5 font-mono text-sm leading-[1.6] text-[var(--text)] outline-none placeholder:text-[var(--faint)]"
        />
        <div
          aria-label={messages.starter.preview}
          className="grid min-h-[120px] place-items-center overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--bg)] [background-image:radial-gradient(circle,var(--grid)_1px,transparent_1.4px)] [background-size:16px_16px] sm:min-h-0"
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
              {inputText.trim() && hasIssues
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
            <div key={issue} className="flex items-center gap-1.5">
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
  const canApply = canApplyStarter(starter);

  return (
    <div className="flex w-full items-center gap-2">
      <Button size="lg" variant="secondary" onClick={onUseSample}>
        {messages.chrome.starterUseSample}
      </Button>
      <span className="flex-1" />
      <Button
        disabled={!canApply}
        size="lg"
        variant={canApply ? "primary" : "disabled"}
        className="px-4"
        onClick={() => starter.applyText()}
      >
        <FileInput className="size-[15px]" aria-hidden="true" />
        {messages.chrome.starterApply}
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
    <div className="-mx-4 -mt-3.5 -mb-4 flex min-h-0 flex-1 flex-col overflow-hidden">
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
    <fieldset className="rounded-lg border border-[var(--line)] bg-[var(--fill)] px-3 py-3">
      <legend className="px-1 text-[13px] font-semibold text-[var(--text)]">
        {messages.starter.ambiguousTitle}
      </legend>
      <p className="mb-2 text-xs text-[var(--muted)]">
        {messages.starter.ambiguousHelp}
      </p>
      <div className="flex flex-wrap gap-2">
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
        "touch:min-h-11 flex min-h-10 flex-1 items-center justify-between gap-3 rounded-lg px-3 text-left text-xs",
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
