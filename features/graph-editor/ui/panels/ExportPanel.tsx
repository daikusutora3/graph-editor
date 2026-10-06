"use client";
import { integrityCopy } from "../../i18n/integrity-copy";

import {
  Camera,
  ClipboardCopy,
  Download,
  FileJson,
  FileText,
} from "lucide-react";
import { memo, useMemo } from "react";

import {
  GRAPH_EXPORT_FORMATS,
  type GraphExportFormat,
} from "../../io/export-graph";
import { useI18n } from "../../i18n/I18nProvider";
import type { CopyState } from "../io/graph-io-types";
import { useExportLineLayout } from "../io/use-export-line-layout";
import { Button, Notice, Select } from "../primitives";

export function ExportPanelBody({
  exportFormat,
  exportText,
  exportWarning,
  mobile,
  pending = false,
  onExportFormatChange,
  onOpenImage,
}: {
  exportFormat: GraphExportFormat;
  exportText: string;
  exportWarning?: string;
  mobile: boolean;
  pending?: boolean;
  onExportFormatChange: (format: GraphExportFormat) => void;
  onOpenImage: () => void;
}) {
  const { messages, locale } = useI18n();
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
      <div
        role="group"
        aria-label={messages.exportPanel.purpose}
        className="grid grid-cols-3 gap-1.5"
      >
        {[
          {
            label: messages.exportPanel.purposes.save,
            detail: "JSON",
            icon: FileJson,
            active: exportFormat === "json",
            onClick: () => onExportFormatChange("json"),
          },
          {
            label: messages.exportPanel.purposes.data,
            detail: "TXT / TeX",
            icon: FileText,
            active: exportFormat !== "json",
            onClick: () => onExportFormatChange("edge-list"),
          },
          {
            label: messages.exportPanel.purposes.image,
            detail: "PNG",
            icon: Camera,
            active: false,
            onClick: onOpenImage,
          },
        ].map(({ label, detail, icon: Icon, active, onClick }) => (
          <Button
            key={label}
            aria-label={label}
            aria-pressed={detail === "PNG" ? undefined : active}
            active={active}
            className="h-auto min-h-20 min-w-0 flex-col gap-1 px-1 py-2 text-center whitespace-normal"
            onClick={onClick}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="text-xs leading-snug">{label}</span>
            <span className="text-[10px] font-normal">{detail}</span>
          </Button>
        ))}
      </div>
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
          ref={lineLayout.ref}
          aria-busy={pending || lineLayout.pending}
          aria-label={messages.exportPanel.exportedAria(
            messages.exportPanel.formats[exportFormat],
          )}
          className="text-control m-0 overflow-x-auto border-l border-[var(--hair)] pl-2.5 font-mono leading-[1.6] whitespace-pre text-[var(--text)] tabular-nums"
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
    <div className="grid w-full grid-cols-2 gap-2">
      <Button
        className="h-auto min-h-11 min-w-0 px-2 py-2 whitespace-normal"
        disabled={disabled}
        size="lg"
        variant={disabled ? "disabled" : "secondary"}
        onClick={onSaveTxt}
      >
        <Download className="size-icon-sm shrink-0" aria-hidden="true" />
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
        className="h-auto min-h-11 min-w-0 px-2 py-2 whitespace-normal"
        onClick={onCopy}
      >
        <ClipboardCopy className="size-icon-sm shrink-0" aria-hidden="true" />
        {copyState === "copied"
          ? messages.chrome.copied
          : copyState === "blocked"
            ? messages.chrome.copyFailed
            : messages.chrome.copy}
      </Button>
    </div>
  );
}
