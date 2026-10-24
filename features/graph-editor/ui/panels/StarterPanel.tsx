"use client";
import {
  BookOpen,
  CircleAlert,
  FileInput,
  ArrowUpRight,
  ChevronDown,
} from "lucide-react";
import {
  Component,
  lazy,
  Suspense,
  type ReactNode,
  type RefObject,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { Button, ChoiceButton, Select } from "@/components/ui/controls";
import { cn } from "@/lib/utils";
import { contentNavigationCopy } from "@/lib/content-navigation";
import { appGuidePaths } from "@/lib/site-metadata";
import { focusRing } from "@/components/ui/styles";

import { useI18n } from "../../i18n/I18nProvider";
import { integrityCopy } from "../../i18n/integrity-copy";
import { inputGuidanceCopy } from "../../i18n/input-guidance-copy";
import { formatImportWarning } from "../../i18n/import-warning-messages";
import type {
  ImportAnalysis,
  ImportCandidate,
  ImportFormatKind,
} from "../../io/import-types";
import type { ImportFormat } from "../../io/import-utils";

import type { useGraphStarterState } from "../../workflows/starter/graph-starter-state";
import {
  canApplyStarterInput,
  getStarterInputStatus,
  isStarterApplyShortcut,
} from "../../workflows/starter/starter-input-status";
import { SAMPLE_GALLERY_GRID_CLASS } from "../samples/sample-gallery-layout";
import { SampleGraphPreview } from "../samples/SampleGraphPreview";

function createSampleGallery() {
  return lazy(() =>
    import("../samples/SampleGalleryPane").then((module) => ({
      default: module.SampleGalleryPane,
    })),
  );
}

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
  const guidance = inputGuidanceCopy[locale];
  const inputId = useId();
  const formatId = useId();
  const helpId = useId();
  const issuesId = useId();
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
    analysis?.status === "invalid" ||
    analysis?.status === "limit" ||
    preview?.status === "failure"
      ? "error"
      : "warning";

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
        <div className="min-w-0 flex-1 basis-[220px]">
          <label
            htmlFor={inputId}
            className="text-control font-semibold text-[var(--text)]"
          >
            {messages.starter.inputLabel}
          </label>
          <p
            id={helpId}
            className="mt-1 text-xs leading-relaxed text-[var(--muted)]"
          >
            {messages.chrome.starterHelp}
          </p>
        </div>
        <div className="flex max-w-full flex-wrap items-center gap-2">
          <label
            htmlFor={formatId}
            className="text-xs font-semibold text-[var(--text-2)]"
          >
            {messages.starter.formatLabel}
          </label>
          <Select
            id={formatId}
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
                ? issueSeverity === "error"
                  ? "text-[var(--danger)]"
                  : "text-[var(--warning-text)]"
                : "text-[var(--muted)]",
            )}
          >
            {meta}
          </span>
        </div>
      </div>
      <details
        data-import-example
        className="group rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3"
      >
        <summary className="ge-focus flex min-h-11 cursor-pointer items-center gap-2 rounded-md text-control font-semibold text-[var(--text-2)]">
          <ChevronDown
            aria-hidden="true"
            className="size-3.5 shrink-0 text-[var(--muted)] transition-transform group-open:rotate-180"
          />
          {guidance.example}
          <span className="min-w-0 text-xs font-normal text-[var(--muted)]">
            {
              messages.starter.formats[
                importFormat === "auto" ? "contest-edge-list" : importFormat
              ]
            }
          </span>
        </summary>
        <div className="flex flex-col items-start gap-2 pb-3">
          <p className="text-xs leading-relaxed text-[var(--muted)]">
            {guidance.exampleHelp}
          </p>
          <pre
            tabIndex={0}
            aria-label={guidance.example}
            className="ge-focus ge-focus-inset max-h-48 w-full overflow-auto rounded-md bg-[var(--fill)] p-3 font-mono text-control leading-relaxed text-[var(--text)]"
          >
            {starter.inputExample}
          </pre>
          {!inputText.trim() ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                starter.setInput(starter.inputExample);
                textareaRef.current?.focus();
              }}
            >
              {guidance.exampleAction}
            </Button>
          ) : null}
        </div>
      </details>
      <a
        href={`${appGuidePaths[locale]}#${importFormat === "adjacency-matrix" ? "adjacency-matrix" : ["auto", "contest-edge-list", "edge-pairs"].includes(importFormat) ? "edge-list" : "guide-import"}`}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex min-h-11 w-fit max-w-full items-center gap-2 rounded-lg px-2 text-xs text-[var(--text-2)] transition-colors hover:text-[var(--text)] active:opacity-80",
          focusRing,
        )}
      >
        <BookOpen className="size-3.5 shrink-0" aria-hidden="true" />
        {contentNavigationCopy[locale].inputHelp}
        <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="sr-only">
          ({contentNavigationCopy[locale].newTab})
        </span>
      </a>
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
          id={inputId}
          name="graph-input"
          value={inputText}
          aria-describedby={`${helpId}${visibleIssues.length > 0 ? ` ${issuesId}` : ""}`}
          aria-invalid={
            issueSeverity === "error" && Boolean(inputText.trim())
              ? true
              : undefined
          }
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => starter.setInput(event.target.value)}
          onKeyDown={(event) => {
            if (isStarterApplyShortcut(event.nativeEvent)) {
              event.preventDefault();
              if (canApply) {
                starter.applyText();
              }
            }
          }}
          className="ge-focus ge-scrollbar min-h-[220px] w-full resize-none rounded-lg border border-[var(--control-border)] bg-[var(--fill)] px-3 py-3.5 font-mono text-control leading-[1.5] text-[var(--text)] outline-none placeholder:text-[var(--muted)] @min-[480px]/editor:px-4 @min-[480px]/editor:text-sm @min-[480px]/editor:leading-[1.6]"
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
          id={issuesId}
          data-import-issues
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
            <details data-import-diagnostics className="mt-1">
              <summary className="ge-focus min-h-11 cursor-pointer rounded-md py-3 underline underline-offset-4">
                {messages.starter.moreIssues(visibleIssues.length - 3)}
              </summary>
              <ul className="flex list-disc flex-col gap-1.5 pl-5 leading-relaxed">
                {visibleIssues.slice(3).map((issue) => (
                  <li key={formatImportWarning(issue, locale)}>
                    {formatImportWarning(issue, locale)}
                  </li>
                ))}
              </ul>
            </details>
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

  useLayoutEffect(() => starter.cancelFileRead, [starter.cancelFileRead]);

  return (
    <div className="grid w-full min-w-0 grid-cols-2 items-stretch gap-2 @min-[640px]/editor:flex @min-[640px]/editor:flex-wrap">
      <Button size="lg" variant="secondary" wrap onClick={onUseSample}>
        <span className="min-w-0 whitespace-normal">
          {messages.chrome.starterUseSample}
        </span>
      </Button>
      <Button
        size="lg"
        variant="secondary"
        wrap
        onClick={() => fileInputRef.current?.click()}
      >
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
        wrap
        className="col-span-2 max-w-full @min-[640px]/editor:ml-auto"
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
  const [attempt, setAttempt] = useState(() => ({
    id: 0,
    Gallery: createSampleGallery(),
  }));
  const retry = () =>
    setAttempt((current) => ({
      id: current.id + 1,
      Gallery: createSampleGallery(),
    }));
  const { Gallery } = attempt;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <SampleGalleryBoundary key={attempt.id} onRetry={retry}>
        <Suspense fallback={<SampleGalleryFallback />}>
          <Gallery onSampleApplied={onSampleApplied} />
        </Suspense>
      </SampleGalleryBoundary>
    </div>
  );
}

class SampleGalleryBoundary extends Component<
  { children: ReactNode; onRetry: () => void },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    return this.state.failed ? (
      <SampleGalleryLoadError onRetry={this.props.onRetry} />
    ) : (
      this.props.children
    );
  }
}

function SampleGalleryLoadError({ onRetry }: { onRetry: () => void }) {
  const { locale, messages } = useI18n();
  return (
    <div
      role="alert"
      className="flex min-h-0 flex-1 flex-col items-start gap-3 p-4"
    >
      <p className="m-0 text-control leading-relaxed text-[var(--muted)]">
        {messages.starter.samplesLoadFailed}
      </p>
      <Button variant="secondary" onClick={onRetry}>
        {integrityCopy[locale].retry}
      </Button>
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
      <Button size="lg" variant="secondary" wrap onClick={onBackToPaste}>
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
    <ChoiceButton
      onClick={() => onSelect(candidate.formatKind)}
      className="flex-col items-start gap-1 text-left"
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
    </ChoiceButton>
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
