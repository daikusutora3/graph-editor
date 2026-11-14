"use client";
import {
  BookOpen,
  CircleAlert,
  FileInput,
  FolderOpen,
  LayoutGrid,
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

import {
  Button,
  ChoiceButton,
  LinkButton,
  Select,
  fieldLabel,
  fieldSurface,
} from "@/components/ui/controls";
import { cn } from "@/lib/utils";
import { contentNavigationCopy } from "@/lib/content-navigation";
import { appGuidePaths } from "@/lib/site-metadata";

import { useI18n } from "../../i18n/I18nProvider";
import { integrityCopy } from "../../i18n/integrity-copy";
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
import { useShortcutPlatform } from "../hooks/shortcut-platform";
import { surface } from "@/components/ui/surfaces";

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

  const guideHref = `${appGuidePaths[locale]}#${importFormat === "adjacency-matrix" ? "adjacency-matrix" : ["auto", "contest-edge-list", "edge-pairs"].includes(importFormat) ? "edge-list" : "guide-import"}`;
  const statusTone =
    hasIssues && inputText.trim()
      ? issueSeverity === "error"
        ? "text-[var(--danger)]"
        : "text-[var(--warning-text)]"
      : "text-[var(--muted)]";

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label htmlFor={formatId} className={fieldLabel}>
          {messages.starter.formatLabel}
        </label>
        <Select
          id={formatId}
          value={importFormat}
          containerClassName="min-w-0 flex-1 @min-[560px]/editor:w-[15rem] @min-[560px]/editor:flex-none"
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
        <LinkButton
          href={guideHref}
          external
          newTabLabel={`${contentNavigationCopy[locale].inputHelp}, ${contentNavigationCopy[locale].newTab}`}
          className="-mr-1 ml-auto"
          icon={<BookOpen className="size-3.5" aria-hidden="true" />}
        >
          {messages.appMenu.guide}
        </LinkButton>
        <p id={helpId} className="sr-only">
          {messages.chrome.starterHelp}
        </p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1.5">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <label htmlFor={inputId} className={fieldLabel}>
            {messages.starter.inputLabel}
          </label>
          <span
            role="status"
            aria-live="polite"
            className={cn(
              "min-w-0 truncate font-mono text-meta font-semibold",
              statusTone,
            )}
          >
            {meta}
          </span>
        </div>
        <div className="ge-paste-grid grid min-h-[352px] flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_auto] gap-3 sm:min-h-[260px] sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:grid-rows-1">
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
            placeholder={`${messages.starter.formatGuides[importFormat]}\n\n${messages.starter.exampleLabel}\n${starter.inputExample}`}
            data-example={starter.inputExample}
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
            className={cn(
              "ge-focus ge-scrollbar h-full min-h-[220px] w-full resize-none rounded-lg px-3.5 py-3 font-mono text-sm leading-[1.6] text-[var(--text)] outline-none placeholder:text-[var(--muted)]",
              fieldSurface,
            )}
          />
          <div
            aria-label={messages.starter.preview}
            className={cn(
              "ge-paste-preview",
              surface.inset,
              "grid min-h-[160px] place-items-center overflow-hidden [background-image:radial-gradient(circle,var(--grid)_1px,transparent_1.4px)] [background-size:16px_16px] p-3 sm:min-h-0",
            )}
          >
            {canApply && previewModel ? (
              <SampleGraphPreview
                model={previewModel}
                variant="editor"
                width={320}
                height={300}
                className="h-full max-h-full w-full"
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
      </div>
      {starter.fileReadState.status === "failed" ? (
        <p role="alert" className="text-xs text-[var(--danger)]">
          {starter.fileReadState.reason === "too-large"
            ? messages.starter.fileTooLarge(starter.fileReadState.limit)
            : messages.starter.fileReadFailed}
        </p>
      ) : null}
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
  const platform = useShortcutPlatform();
  const applyShortcut =
    platform === "mac" ? "⌘↵" : platform === "other" ? "Ctrl+↵" : null;

  useLayoutEffect(() => starter.cancelFileRead, [starter.cancelFileRead]);

  return (
    <div className="grid w-full min-w-0 grid-cols-2 gap-2 @min-[480px]/editor:grid-cols-3">
      <Button size="lg" variant="secondary" wrap onClick={onUseSample}>
        <LayoutGrid className="size-icon-sm shrink-0" aria-hidden="true" />
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
        <FolderOpen className="size-icon-sm shrink-0" aria-hidden="true" />
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
        tooltip={
          applyShortcut
            ? messages.chrome.starterApplyHint(applyShortcut)
            : undefined
        }
        tooltipSide="top"
        className="col-span-2 @min-[480px]/editor:col-span-1"
        onClick={() => starter.applyText()}
      >
        <FileInput className="size-icon-sm shrink-0" aria-hidden="true" />
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
    <fieldset className={cn(surface.inset, "min-w-0 p-3")}>
      <legend className="float-left mb-1 w-full text-control font-semibold text-[var(--text)]">
        {messages.starter.ambiguousTitle}
      </legend>
      <p className="clear-left mb-2.5 text-xs leading-relaxed text-[var(--muted)]">
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
              className={cn(surface.card, "flex flex-col gap-3 p-3")}
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
