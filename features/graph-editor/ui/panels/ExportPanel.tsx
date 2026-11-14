"use client";

import { ClipboardCopy, Download } from "lucide-react";
import { memo, useId, useMemo } from "react";

import {
  Button,
  Notice,
  PanelActions,
  Select,
  fieldLabel,
} from "@/components/ui/controls";

import { integrityCopy } from "../../i18n/integrity-copy";
import { inputGuidanceCopy } from "../../i18n/input-guidance-copy";
import {
  GRAPH_EXPORT_FORMATS,
  type GraphExportFormat,
} from "../../io/export-graph";
import { useI18n } from "../../i18n/I18nProvider";
import type { CopyState } from "../io/graph-io-types";
import { useExportLineLayout } from "../io/use-export-line-layout";
import { surface, textStyle } from "@/components/ui/surfaces";
import { cn } from "@/lib/utils";

export function ExportPanelBody({
  exportFormat,
  exportText,
  exportWarning,
  pending,
  onExportFormatChange,
}: {
  exportFormat: GraphExportFormat;
  exportText: string;
  exportWarning?: string;
  pending: boolean;
  onExportFormatChange: (format: GraphExportFormat) => void;
}) {
  const { messages, locale } = useI18n();
  const formatId = useId();
  const lineLayout = useExportLineLayout(exportText);
  const lines = useMemo(
    () => (exportText ? exportText.split("\n") : []),
    [exportText],
  );
  const lineNumbers = useMemo(
    () => lines.map((_, index) => String(index + 1)),
    [lines],
  );

  return (
    <>
      <div className="flex min-w-0 items-center gap-3">
        <label htmlFor={formatId} className={fieldLabel}>
          {messages.starter.formatLabel}
        </label>
        <Select
          id={formatId}
          aria-label={messages.exportPanel.formatAria}
          containerClassName="min-w-0 flex-1"
          value={exportFormat}
          onChange={(event) =>
            onExportFormatChange(event.target.value as GraphExportFormat)
          }
        >
          {GRAPH_EXPORT_FORMATS.map((format) => (
            <option key={format.value} value={format.value}>
              {messages.exportPanel.formats[format.value]}
            </option>
          ))}
        </Select>
      </div>
      {exportWarning ? <Notice>{exportWarning}</Notice> : null}
      <div className="flex min-h-0 flex-col gap-1.5">
        <div
          className={cn(
            surface.inset,
            "grid min-h-[240px] grid-cols-[max-content_minmax(0,1fr)] content-start py-3",
          )}
        >
          <div
            aria-hidden="true"
            className="min-w-7 pr-2 text-right font-mono text-control leading-[1.6] whitespace-pre text-[var(--muted)] tabular-nums select-none"
          >
            <ExportText lines={lineNumbers} />
          </div>
          <pre
            ref={lineLayout.ref}
            role="region"
            tabIndex={0}
            aria-busy={pending || lineLayout.pending}
            aria-label={messages.exportPanel.exportedAria(
              messages.exportPanel.formats[exportFormat],
            )}
            className="ge-focus ge-focus-inset m-0 overflow-x-auto border-l border-[var(--hair)] pl-2.5 font-mono text-control leading-[1.6] whitespace-pre text-[var(--text)] tabular-nums"
          >
            {lineLayout.pending ? (
              <span className="text-[var(--muted)]">
                {messages.exportPanel.preparing}
              </span>
            ) : lineLayout.layout ? (
              <span
                className="relative block h-[1lh]"
                style={{ width: lineLayout.layout.width }}
              >
                {lineLayout.layout.chunks.map((chunk) => (
                  <span
                    key={chunk.x}
                    data-export-line-chunk
                    className="absolute top-0 h-[1lh]"
                    style={{
                      left: chunk.x,
                      width: chunk.width,
                      contentVisibility: "auto",
                      containIntrinsicSize: `auto ${chunk.width}px auto 1lh`,
                    }}
                  >
                    {chunk.text}
                  </span>
                ))}
              </span>
            ) : exportText ? (
              <ExportText lines={lines} wide />
            ) : (
              <span className="text-[var(--muted)]">
                {pending
                  ? messages.exportPanel.preparing
                  : messages.exportPanel.emptyPlaceholder}
              </span>
            )}
          </pre>
        </div>
        <p className={cn(textStyle.note, "shrink-0")}>
          {exportFormat === "tikz"
            ? messages.exportPanel.tikzNote
            : exportFormat === "json"
              ? messages.exportPanel.jsonNote
              : integrityCopy[locale].textNote}
        </p>
      </div>
    </>
  );
}

const ExportText = memo(function ExportText({
  lines,
  wide = false,
}: {
  lines: string[];
  wide?: boolean;
}) {
  if (lines.length <= 100) return lines.join("\n");
  const groups = [];
  for (let start = 0; start < lines.length; start += 50) {
    const end = Math.min(lines.length, start + 50);
    groups.push(
      <span
        key={start}
        data-export-chunk
        className={wide ? "block w-max min-w-full" : "block"}
        style={{
          contentVisibility: "auto",
          containIntrinsicBlockSize: `auto ${end - start}lh`,
          containIntrinsicInlineSize: wide ? "auto 0px" : undefined,
        }}
      >
        {lines.slice(start, end).join("\n") + (end < lines.length ? "\n" : "")}
      </span>,
    );
  }
  return groups;
});

export function ExportPanelFooter({
  copyState,
  disabled,
  extension,
  onCopy,
  onSaveTxt,
}: {
  copyState: CopyState;
  disabled: boolean;
  extension: string;
  onCopy: () => void;
  onSaveTxt: () => void;
}) {
  const { messages, locale } = useI18n();
  const guidance = inputGuidanceCopy[locale];
  const statusId = useId();

  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <PanelActions>
        <Button
          disabled={disabled}
          size="lg"
          wrap
          variant={disabled ? "disabled" : "secondary"}
          onClick={onSaveTxt}
        >
          <Download className="size-icon-sm shrink-0" aria-hidden="true" />
          {messages.chrome.saveAs(extension)}
        </Button>
        <Button
          disabled={disabled}
          size="lg"
          wrap
          variant={
            disabled
              ? "disabled"
              : copyState === "copied"
                ? "success"
                : copyState === "blocked"
                  ? "warning"
                  : "primary"
          }
          onClick={onCopy}
          aria-describedby={copyState === "blocked" ? statusId : undefined}
        >
          <ClipboardCopy className="size-icon-sm shrink-0" aria-hidden="true" />
          {copyState === "copied"
            ? messages.chrome.copied
            : copyState === "blocked"
              ? messages.chrome.copyFailed
              : messages.chrome.copy}
        </Button>
      </PanelActions>
      <p
        id={statusId}
        role="status"
        aria-atomic="true"
        className={
          copyState === "idle"
            ? "sr-only"
            : "text-xs leading-relaxed text-[var(--text-2)]"
        }
      >
        {copyState === "blocked"
          ? guidance.copyFailure
          : copyState === "copied"
            ? guidance.copySuccess
            : ""}
      </p>
    </div>
  );
}
