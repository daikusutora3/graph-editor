"use client";

import { FileInput } from "lucide-react";
import type { ClipboardEvent, RefObject } from "react";

import { cn } from "@/lib/utils";

import { useI18n } from "../i18n/I18nProvider";
import type { StarterTab } from "../workflows/starter/graph-starter-state";

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
  textareaRef,
  onInputTextChange,
  onPaste,
  onApply,
}: {
  inputText: string;
  issues: string[];
  previewFormat?: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onInputTextChange: (value: string) => void;
  onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  onApply: () => void;
}) {
  const { messages } = useI18n();

  return (
    <div className="flex h-full min-h-0 flex-col gap-[var(--app-space-3)]">
      <div className="flex items-center justify-between gap-[var(--app-space-3)] px-1">
        <p className="gv-microcopy min-w-0">
          {messages.starter.autoDetectHelp}
        </p>
        <FormatBadge
          format={previewFormat}
          hasInput={Boolean(inputText.trim())}
          hasIssues={issues.length > 0}
        />
      </div>
      <div className="relative min-h-0 flex-1">
        <textarea
          ref={textareaRef}
          name="graph-input"
          value={inputText}
          aria-label={`${messages.starter.paste}: ${messages.starter.autoDetectHelp}`}
          autoComplete="off"
          onChange={(event) => onInputTextChange(event.target.value)}
          onPaste={onPaste}
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
      {issues.length > 0 ? (
        <div className="rounded-[var(--app-radius-sm)] border border-[var(--err)] bg-[var(--err-soft)] px-[var(--app-space-4)] py-[var(--app-space-3)] font-mono text-[length:var(--app-text-sm)] leading-[var(--app-leading-code)] text-[var(--err)]">
          {issues.slice(0, 3).map((issue) => (
            <div key={issue}>{issue}</div>
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

function FormatBadge({
  format,
  hasInput,
  hasIssues,
}: {
  format?: string;
  hasInput: boolean;
  hasIssues: boolean;
}) {
  const { messages } = useI18n();

  if (!hasInput) {
    return null;
  }

  if (hasIssues) {
    return (
      <span className="gv-chip shrink-0 border-transparent bg-[var(--err-soft)] text-[var(--err)]">
        {messages.starter.needsReview}
      </span>
    );
  }

  return (
    <span className="gv-chip shrink-0 border-transparent bg-[var(--ok-soft)] text-[var(--ok)]">
      <span className="size-1.5 rounded-full bg-[var(--ok)]" />
      {messages.starter.detected(format ?? "graph")}
    </span>
  );
}
