"use client";
import { integrityCopy } from "../../i18n/integrity-copy";

import { ClipboardCopy, Download } from "lucide-react";
import { memo, useMemo } from "react";

import {
  GRAPH_EXPORT_FORMATS,
  type GraphExportFormat,
} from "../../io/export-graph";
import { useI18n } from "../../i18n/I18nProvider";
import type { CopyState } from "../io/graph-io-types";
import { Button, Notice, Select } from "../primitives";

export function ExportPanelBody({
  exportFormat,
  exportText,
  exportWarning,
  mobile,
  pending = false,
  onExportFormatChange,
}: {
  exportFormat: GraphExportFormat;
  exportText: string;
  exportWarning?: string;
  mobile: boolean;
  pending?: boolean;
  onExportFormatChange: (format: GraphExportFormat) => void;
}) {
  const { messages, locale } = useI18n();
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
      <label className="grid shrink-0 gap-1.5 text-xs text-[var(--muted)]">
        {messages.exportPanel.formatAria}
        <Select
          aria-label={messages.exportPanel.formatAria}
          className={mobile ? "h-11" : undefined}
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
      </label>
      {exportWarning ? <Notice>{exportWarning}</Notice> : null}
      {exportFormat === "tikz" ? (
        <p className="shrink-0 text-xs leading-[1.5] text-[var(--muted)]">
          {messages.exportPanel.tikzNote}
        </p>
      ) : exportFormat === "json" ? (
        <p className="shrink-0 text-xs leading-[1.5] text-[var(--muted)]">
          {messages.exportPanel.jsonNote}
        </p>
      ) : (
        <p className="text-xs text-[var(--muted)]">
          {integrityCopy[locale === "ja" ? "ja" : "en"].textNote}
        </p>
      )}
      <div className="grid min-h-[200px] grid-cols-[28px_minmax(0,1fr)] rounded-lg border border-[var(--line)] bg-[var(--bg)] py-3">
        <div
          aria-hidden="true"
          className="text-control pr-2 text-right font-mono leading-[1.6] whitespace-pre text-[var(--muted)] tabular-nums select-none"
        >
          <ExportText lines={lineNumbers} />
        </div>
        <pre
          aria-busy={pending}
          aria-label={messages.exportPanel.exportedAria(
            messages.exportPanel.formats[exportFormat],
          )}
          className="text-control m-0 overflow-x-auto border-l border-[var(--hair)] pl-2.5 font-mono leading-[1.6] whitespace-pre text-[var(--text)] tabular-nums"
        >
          {exportText ? (
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
    </>
  );
}

// Keep every character in the DOM for selection and copying. Large exports
// only lay out the visible groups; unsupported browsers retain the full view.
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
  const { messages } = useI18n();

  return (
    <div className="flex w-full justify-end gap-2">
      <Button
        disabled={disabled}
        size="lg"
        variant={disabled ? "disabled" : "secondary"}
        onClick={onSaveTxt}
      >
        <Download className="size-icon-sm" aria-hidden="true" />
        {messages.chrome.saveAs(extension)}
      </Button>
      <Button
        disabled={disabled}
        size="lg"
        variant={
          disabled
            ? "disabled"
            : copyState === "copied"
              ? "success"
              : copyState === "blocked"
                ? "warning"
                : "primary"
        }
        className="px-4"
        onClick={onCopy}
      >
        <ClipboardCopy className="size-icon-sm" aria-hidden="true" />
        {copyState === "copied"
          ? messages.chrome.copied
          : copyState === "blocked"
            ? messages.chrome.copyFailed
            : messages.chrome.copy}
      </Button>
    </div>
  );
}
