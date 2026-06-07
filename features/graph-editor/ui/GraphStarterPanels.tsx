"use client";

import { FileInput } from "lucide-react";
import type { RefObject } from "react";

import { cn } from "@/lib/utils";

import type { GraphModel } from "../core/graph/model";
import { hasGraphContent } from "../core/graph/selectors";
import { useI18n } from "../i18n/I18nProvider";
import { formatImportWarning } from "../i18n/import-warning-messages";
import type { ImportFormatKind } from "../io/import-types";
import type { StarterTab } from "../workflows/starter/graph-starter-state";
import { SampleGraphPreview } from "./SampleGraphPreview";

export function StarterTabButton({
  tab,
  current,
  label,
  onClick,
}: {
  tab: StarterTab;
  current: StarterTab;
  label: string;
  onClick: (tab: StarterTab) => void;
}) {
  const selected = tab === current;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={() => onClick(tab)}
      className="gv-starter-tab-button"
    >
      {label}
    </button>
  );
}

export function PasteStarterPane({
  inputText,
  issues,
  previewFormat,
  previewModel,
  textareaRef,
  onInputTextChange,
  onApply,
}: {
  inputText: string;
  issues: string[];
  previewFormat?: ImportFormatKind;
  previewModel?: GraphModel;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onInputTextChange: (value: string) => void;
  onApply: () => void;
}) {
  const { locale, messages } = useI18n();

  return (
    <div className="flex h-full min-h-0 flex-col gap-[var(--app-space-3)]">
      <div className="flex min-h-8 items-center justify-between gap-[var(--app-space-3)] px-1">
        <p className="gv-microcopy min-w-0 truncate">
          {messages.starter.autoDetectHelp}
        </p>
        <FormatBadge
          format={previewFormat}
          hasInput={Boolean(inputText.trim())}
          hasIssues={issues.length > 0}
        />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_14rem] gap-[var(--app-space-3)] max-[760px]:grid-cols-1 max-[760px]:grid-rows-[minmax(0,1fr)_14rem]">
        <div className="relative min-h-0">
          <textarea
            ref={textareaRef}
            name="graph-input"
            value={inputText}
            aria-label={`${messages.starter.paste}: ${messages.starter.autoDetectHelp}`}
            autoComplete="off"
            onChange={(event) => onInputTextChange(event.target.value)}
            onKeyDown={(event) => {
              if (
                (event.metaKey || event.ctrlKey) &&
                event.key === "Enter" &&
                inputText.trim()
              ) {
                event.preventDefault();
                onApply();
              }
            }}
            spellCheck={false}
            placeholder={messages.starter.pastePlaceholder}
            className="gv-code-surface gv-paste-input gv-scrollbar h-full min-h-0 w-full resize-none text-[length:var(--app-text-sm)] outline-none placeholder:text-[var(--text-mute)]"
          />
        </div>
        <PastePreviewPanel
          hasInput={Boolean(inputText.trim())}
          hasIssues={issues.length > 0}
          model={previewModel}
        />
      </div>
      {issues.length > 0 ? (
        <div className="rounded-[var(--app-radius-sm)] border border-[var(--err)] bg-[var(--err-soft)] px-[var(--app-space-4)] py-[var(--app-space-3)] font-mono text-[length:var(--app-text-sm)] leading-[var(--app-leading-code)] text-[var(--err)]">
          {issues.slice(0, 3).map((issue) => (
            <div key={issue}>{formatImportWarning(issue, locale)}</div>
          ))}
        </div>
      ) : null}
      <div className="flex justify-end">
        <button
          type="button"
          disabled={!inputText.trim()}
          onClick={onApply}
          className={cn(
            "gv-control h-9 px-[var(--app-space-4)] text-[length:var(--app-text-sm)]",
            inputText.trim() ? "gv-control-primary" : "text-[var(--text-mute)]",
          )}
        >
          <FileInput className="size-4" />
          {messages.starter.apply}
        </button>
      </div>
    </div>
  );
}

function PastePreviewPanel({
  hasInput,
  hasIssues,
  model,
}: {
  hasInput: boolean;
  hasIssues: boolean;
  model?: GraphModel;
}) {
  const { messages } = useI18n();
  const hasPreview = model ? hasGraphContent(model) : false;

  return (
    <section
      aria-label={messages.starter.preview}
      className="flex min-h-0 flex-col overflow-hidden rounded-[var(--app-radius-md)] border border-[color-mix(in_srgb,var(--divider)_72%,transparent)] bg-[var(--bg-deep)]"
    >
      <div className="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-[color-mix(in_srgb,var(--divider)_60%,transparent)] bg-[var(--surface)] px-2">
        <span className="text-[length:var(--app-text-xs)] leading-none font-bold text-[var(--text-dim)]">
          {messages.starter.preview}
        </span>
        {hasPreview && model ? (
          <span className="truncate text-[0.6875rem] leading-none font-semibold text-[var(--text-mute)]">
            {messages.starter.previewStats(
              model.nodes.length,
              model.edges.length,
            )}
          </span>
        ) : null}
      </div>
      <div className="grid min-h-0 flex-1 place-items-center bg-[var(--bg-deep)] bg-[image:radial-gradient(circle,var(--canvas-grid)_1px,transparent_1.4px)] bg-[size:24px_24px] p-2">
        {hasPreview && model ? (
          <SampleGraphPreview
            model={model}
            variant="editor"
            width={196}
            height={176}
          />
        ) : (
          <span
            className={cn(
              "px-2 text-center text-[length:var(--app-text-xs)] leading-tight font-semibold text-[var(--text-mute)]",
              hasInput && hasIssues && "text-[var(--err)]",
            )}
          >
            {hasInput && hasIssues
              ? messages.starter.needsReview
              : messages.starter.previewEmpty}
          </span>
        )}
      </div>
    </section>
  );
}

function FormatBadge({
  format,
  hasInput,
  hasIssues,
}: {
  format?: ImportFormatKind;
  hasInput: boolean;
  hasIssues: boolean;
}) {
  const { messages } = useI18n();
  const formatLabel = format ? messages.starter.formats[format] : "graph";
  const statusText = hasIssues
    ? messages.starter.needsReview
    : messages.starter.detected(formatLabel);

  if (!hasInput) {
    return <span aria-hidden="true" className="h-5 w-36 shrink-0" />;
  }

  if (hasIssues) {
    return (
      <span className="flex h-5 max-w-[45%] shrink-0 items-center justify-end truncate text-[length:var(--app-text-xs)] leading-none font-semibold whitespace-nowrap text-[var(--err)]">
        {statusText}
      </span>
    );
  }

  return (
    <span className="flex h-5 max-w-[45%] shrink-0 items-center justify-end gap-1 truncate text-[length:var(--app-text-xs)] leading-none font-medium whitespace-nowrap text-[var(--text-mute)]">
      <span className="size-1 rounded-full bg-[var(--text-mute)] opacity-70" />
      <span className="truncate">{statusText}</span>
    </span>
  );
}
