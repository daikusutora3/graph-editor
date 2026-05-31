"use client";

import { Check, ChevronDown, ClipboardCopy, X } from "lucide-react";
import type { ReactNode, Ref } from "react";

import {
  getGraphExportFormat,
  GRAPH_EXPORT_FORMATS,
  type GraphExportFormat,
} from "../io/export-graph";
import { useI18n } from "../i18n/I18nProvider";
import { cn } from "@/lib/utils";

import type { CopyState } from "./graph-io-types";

type DropdownShellProps = {
  title: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  footer?: ReactNode;
  panelRef?: Ref<HTMLElement>;
  panelState?: "open" | "closing";
  right?: string;
  onClose: () => void;
};

export function DropdownShell({
  title,
  children,
  contentClassName,
  footer,
  panelRef,
  panelState = "open",
  right,
  onClose,
}: DropdownShellProps) {
  const { messages } = useI18n();

  return (
    <section
      ref={panelRef}
      data-panel-state={panelState}
      className="gv-popover fixed top-[var(--app-space-3)] right-[calc(3.5rem+var(--app-space-5))] z-[80] flex max-h-[calc(100dvh-var(--app-space-6))] max-h-[calc(100vh-var(--app-space-6))] w-[var(--app-io-panel-width)] max-w-[calc(100vw-var(--app-space-6))] flex-col overflow-hidden"
      style={right ? { right } : undefined}
    >
      <div className="flex min-h-8 shrink-0 items-center justify-between gap-[var(--app-space-3)] border-b border-[var(--divider)] px-[var(--app-space-3)] py-0.5">
        <div className="flex min-w-0 items-center">
          <h2 className="flex min-h-6 min-w-0 items-center text-[length:var(--app-text-xs)] leading-tight font-bold break-words whitespace-normal text-[var(--text)]">
            {title}
          </h2>
        </div>
        <button
          type="button"
          aria-label={messages.common.close}
          onClick={onClose}
          className="gv-icon-button size-6"
        >
          <X className="size-4" />
        </button>
      </div>
      <div
        className={cn(
          "gv-scrollbar min-h-0 flex-1 overflow-y-auto px-[var(--app-space-3)] py-[var(--app-space-2)]",
          contentClassName,
        )}
      >
        {children}
      </div>
      {footer ? (
        <div className="shrink-0 border-t border-[var(--divider)] bg-[var(--surface)] px-[var(--app-space-3)] py-[var(--app-space-2)]">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

type ExportPanelProps = {
  copyState: CopyState;
  edgeCount: number;
  exportFormat: GraphExportFormat;
  exportText: string;
  exportWarning?: string;
  nodeCount: number;
  onCopyExport: () => void;
  onExportFormatChange: (format: GraphExportFormat) => void;
};

export function ExportPanel({
  copyState,
  edgeCount,
  exportFormat,
  exportText,
  exportWarning,
  nodeCount,
  onCopyExport,
  onExportFormatChange,
}: ExportPanelProps) {
  const { messages } = useI18n();
  const exportDefinition = getGraphExportFormat(exportFormat);
  const exportLabel = messages.exportPanel.formats[exportDefinition.value];

  return (
    <div className="flex flex-col gap-[var(--app-space-2)]">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-[var(--app-space-3)]">
        <label className="grid min-w-0 gap-1.5">
          <span className="gv-microcopy">
            {messages.exportPanel.formatAria}
          </span>
          <span className="relative block min-w-0">
            <select
              name="graph-export-format"
              value={exportFormat}
              aria-label={messages.exportPanel.formatAria}
              autoComplete="off"
              onChange={(event) =>
                onExportFormatChange(event.target.value as GraphExportFormat)
              }
              className="gv-select-control"
            >
              {GRAPH_EXPORT_FORMATS.map((format) => (
                <option key={format.value} value={format.value}>
                  {messages.exportPanel.formats[format.value]}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-[var(--text-mute)]"
              aria-hidden="true"
              strokeWidth={2}
            />
          </span>
        </label>
        <div className="flex h-8 shrink-0 items-center gap-2 rounded-[var(--app-radius-sm)] bg-[var(--state-control-bg)] px-[var(--app-space-3)] font-mono text-[length:var(--app-text-xs)] leading-none font-bold text-[var(--text-dim)]">
          <span>N={nodeCount}</span>
          <span>M={edgeCount}</span>
        </div>
      </div>

      {exportWarning ? (
        <p className="rounded-[var(--app-radius-sm)] border border-[var(--warn)] bg-[var(--warn-soft)] px-[var(--app-space-3)] py-[var(--app-space-2)] text-[length:var(--app-text-xs)] leading-[var(--app-leading-tight)] text-[var(--warn)]">
          {exportWarning}
        </p>
      ) : null}

      <div className="relative">
        <textarea
          name="graph-export-output"
          value={exportText || messages.exportPanel.emptyPlaceholder}
          readOnly
          spellCheck={false}
          autoComplete="off"
          aria-label={messages.exportPanel.exportedAria(exportLabel)}
          onFocus={(event) => event.currentTarget.select()}
          className="gv-code-surface gv-export-output min-h-[260px] w-full resize-none overflow-auto whitespace-pre focus-visible:outline-none"
        />
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onCopyExport}
          aria-label={messages.exportPanel.copyAria(exportLabel, copyState)}
          title={
            copyState === "blocked"
              ? messages.exportPanel.copyAria(exportLabel, "blocked")
              : messages.exportPanel.copyAria(exportLabel, "idle")
          }
          className={cn(
            "absolute top-2 right-2 inline-flex h-7 min-w-[4.25rem] items-center justify-center gap-1.5 rounded-[var(--app-radius-sm)] border border-[color-mix(in_srgb,var(--divider)_70%,transparent)] bg-[var(--surface)] px-2.5 leading-none shadow-[var(--app-shadow-card)] transition-colors hover:border-[var(--divider)] hover:bg-[var(--surface)] focus-visible:ring-2 focus-visible:ring-[var(--state-focus-ring)] focus-visible:outline-none",
            copyState === "copied"
              ? "text-[var(--ok)]"
              : copyState === "blocked"
                ? "text-[var(--warn)]"
                : "text-[var(--text-dim)] hover:text-[var(--state-hover-text)]",
          )}
        >
          {copyState === "copied" ? (
            <Check className="size-4" />
          ) : (
            <ClipboardCopy className="size-4" />
          )}
          <span className="[font-family:var(--app-font-ui)] text-[length:var(--app-text-xs)] leading-[var(--app-leading-tight)] font-[650] tracking-normal">
            {copyState === "copied"
              ? messages.common.copied
              : copyState === "blocked"
                ? messages.common.failed
                : messages.common.copy}
          </span>
        </button>
      </div>
    </div>
  );
}
