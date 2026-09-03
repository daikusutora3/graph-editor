"use client";

import { ClipboardCopy, Download } from "lucide-react";

import {
  GRAPH_EXPORT_FORMATS,
  type GraphExportFormat,
} from "../../io/export-graph";
import { useI18n } from "../../i18n/I18nProvider";
import type { CopyState } from "../io/graph-io-types";
import { Button, Notice, Segment } from "../primitives";

export function ExportPanelBody({
  exportFormat,
  exportText,
  exportWarning,
  mobile,
  onExportFormatChange,
}: {
  exportFormat: GraphExportFormat;
  exportText: string;
  exportWarning?: string;
  mobile: boolean;
  onExportFormatChange: (format: GraphExportFormat) => void;
}) {
  const { messages } = useI18n();
  const lines = exportText ? exportText.split("\n") : [];
  const lineNumbers = lines.map((_, index) => index + 1).join("\n");

  return (
    <>
      <Segment
        label={messages.exportPanel.formatAria}
        size={mobile ? "md" : "sm"}
        value={exportFormat}
        options={GRAPH_EXPORT_FORMATS.map((format) => ({
          label: messages.exportPanel.formats[format.value],
          value: format.value,
        }))}
        onChange={onExportFormatChange}
      />
      {exportWarning ? <Notice>{exportWarning}</Notice> : null}
      <div className="grid min-h-[200px] grid-cols-[28px_minmax(0,1fr)] rounded-lg border border-[var(--line)] bg-[var(--bg)] py-3">
        <div
          aria-hidden="true"
          className="pr-2 text-right font-mono text-[13px] leading-[1.6] whitespace-pre text-[var(--muted)] tabular-nums select-none"
        >
          {lineNumbers}
        </div>
        <pre
          aria-label={messages.exportPanel.exportedAria(
            messages.exportPanel.formats[exportFormat],
          )}
          className="m-0 overflow-x-auto border-l border-[var(--hair)] pl-2.5 font-mono text-[13px] leading-[1.6] whitespace-pre text-[var(--text)] tabular-nums"
        >
          {exportText || (
            <span className="text-[var(--faint)]">
              {messages.exportPanel.emptyPlaceholder}
            </span>
          )}
        </pre>
      </div>
    </>
  );
}

export function ExportPanelFooter({
  copyState,
  disabled,
  onCopy,
  onSaveTxt,
}: {
  copyState: CopyState;
  disabled: boolean;
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
        <Download className="size-[15px]" aria-hidden="true" />
        {messages.chrome.saveTxt}
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
        <ClipboardCopy className="size-[15px]" aria-hidden="true" />
        {copyState === "copied"
          ? messages.chrome.copied
          : copyState === "blocked"
            ? messages.chrome.copyFailed
            : messages.chrome.copy}
      </Button>
    </div>
  );
}
