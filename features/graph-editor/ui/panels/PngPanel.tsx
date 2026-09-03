"use client";

import { ClipboardCopy, Download } from "lucide-react";

import { cn } from "@/lib/utils";

import { EXPORT_BACKGROUND_COLORS } from "../../adapters/cytoscape/graph-canvas-viewport";
import { useI18n } from "../../i18n/I18nProvider";
import {
  MAX_LONG_EDGE_PX,
  MAX_PADDING_PX,
  MIN_LONG_EDGE_PX,
  MIN_PADDING_PX,
  PNG_EXPORT_LONG_EDGE_PRESETS,
  type PngExportBackground,
  type PngExportScope,
  type ScreenshotCopyState,
  type ScreenshotDownloadState,
  type ScreenshotPreview,
} from "../io/graph-io-types";
import { Button, Notice, SectionLabel, Segment, Slider } from "../primitives";
import type { ThemeMode } from "../theme/theme";

const LONG_EDGE_STEP = 20;
const PADDING_STEP = 4;

type PngPanelBodyProps = {
  background: PngExportBackground;
  longEdgePx: number;
  mobile: boolean;
  notice: string;
  paddingPx: number;
  preview: ScreenshotPreview;
  scope: PngExportScope;
  solidBackground: "white" | "black";
  theme: ThemeMode;
  onBackgroundChange: (background: PngExportBackground) => void;
  onLongEdgeChange: (value: number) => void;
  onPaddingChange: (value: number) => void;
  onScopeChange: (scope: PngExportScope) => void;
};

export function PngPanelBody({
  background,
  longEdgePx,
  mobile,
  notice,
  paddingPx,
  preview,
  scope,
  solidBackground,
  theme,
  onBackgroundChange,
  onLongEdgeChange,
  onPaddingChange,
  onScopeChange,
}: PngPanelBodyProps) {
  const { messages } = useI18n();
  const segmentSize = mobile ? "md" : "sm";
  const transparent = background === "transparent";
  const ready = preview.state === "ready" && preview.width && preview.height;
  const dimensions = ready ? `${preview.width} × ${preview.height} px` : "—";
  const previewHeight = ready
    ? Math.min(220, Math.round((340 * preview.height!) / preview.width!))
    : 160;

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-1.5">
          <SectionLabel>{messages.screenshot.scope}</SectionLabel>
          <Segment
            label={messages.screenshot.scope}
            size={segmentSize}
            value={scope}
            options={[
              { label: messages.chrome.pngScopeFull, value: "full" },
              { label: messages.chrome.pngScopeView, value: "viewport" },
            ]}
            onChange={onScopeChange}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <SectionLabel>{messages.screenshot.background}</SectionLabel>
          <Segment
            label={messages.screenshot.background}
            size={segmentSize}
            value={background}
            options={[
              {
                label:
                  theme === "dark"
                    ? messages.screenshot.black
                    : messages.screenshot.white,
                value: solidBackground,
              },
              {
                label: messages.chrome.pngTransparent,
                value: "transparent" as const,
              },
            ]}
            onChange={onBackgroundChange}
          />
        </div>
      </div>

      {scope === "full" ? (
        <Slider
          label={messages.chrome.pngSize}
          max={MAX_LONG_EDGE_PX}
          min={MIN_LONG_EDGE_PX}
          name="screenshot-long-edge"
          step={LONG_EDGE_STEP}
          value={longEdgePx}
          presets={PNG_EXPORT_LONG_EDGE_PRESETS}
          onChange={onLongEdgeChange}
        />
      ) : null}

      <Slider
        label={messages.chrome.pngPadding}
        max={MAX_PADDING_PX}
        min={MIN_PADDING_PX}
        name="screenshot-padding"
        step={PADDING_STEP}
        value={paddingPx}
        onChange={onPaddingChange}
      />

      <section
        aria-label={messages.screenshot.preview}
        className="flex shrink-0 flex-col overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel-solid)]"
      >
        <div className="flex h-8 shrink-0 items-center justify-between border-b border-[var(--hair)] px-3">
          <SectionLabel>{messages.screenshot.preview}</SectionLabel>
          <span className="font-mono text-[11px] font-semibold text-[var(--muted)] tabular-nums">
            {dimensions}
          </span>
        </div>
        <div
          className={cn(
            "relative grid w-full shrink-0 place-items-center overflow-hidden",
            transparent && "ge-checker",
          )}
          style={{
            height: previewHeight,
            background: transparent
              ? undefined
              : EXPORT_BACKGROUND_COLORS[solidBackground],
          }}
        >
          {ready && preview.url ? (
            <img
              src={preview.url}
              alt={messages.screenshot.previewAlt}
              className="absolute inset-0 h-full w-full object-contain"
              draggable={false}
            />
          ) : (
            <span className="px-3 text-center text-xs leading-snug font-semibold text-[var(--muted)]">
              {preview.state === "loading"
                ? messages.screenshot.previewLoading
                : preview.state === "failed"
                  ? messages.screenshot.previewFailed
                  : messages.screenshot.previewEmpty}
            </span>
          )}
        </div>
      </section>

      {notice ? <Notice>{notice}</Notice> : null}
    </>
  );
}

export function PngPanelFooter({
  copyState,
  downloadState,
  isGraphEmpty,
  onCopy,
  onDownload,
}: {
  copyState: ScreenshotCopyState;
  downloadState: ScreenshotDownloadState;
  isGraphEmpty: boolean;
  onCopy: () => void;
  onDownload: () => void;
}) {
  const { messages } = useI18n();
  const copyVariant = isGraphEmpty
    ? "disabled"
    : copyState === "copied" || copyState === "saved"
      ? "success"
      : copyState === "blocked"
        ? "warning"
        : "primary";
  const copyLabel =
    copyState === "copying"
      ? messages.chrome.pngCopying
      : copyState === "copied"
        ? messages.chrome.pngCopied
        : copyState === "saved"
          ? messages.chrome.pngSaved
          : copyState === "blocked"
            ? messages.chrome.pngFailed
            : messages.chrome.pngCopy;

  return (
    <div className="flex w-full justify-end gap-2">
      <Button
        aria-busy={downloadState === "saving"}
        disabled={isGraphEmpty || downloadState === "saving"}
        size="lg"
        variant={isGraphEmpty ? "disabled" : "secondary"}
        onClick={onDownload}
      >
        <Download className="size-[15px]" aria-hidden="true" />
        {downloadState === "saving"
          ? messages.chrome.pngSaving
          : messages.chrome.pngSave}
      </Button>
      <Button
        aria-busy={copyState === "copying"}
        disabled={isGraphEmpty || copyState === "copying"}
        size="lg"
        variant={copyVariant}
        className="px-4"
        onClick={onCopy}
      >
        <ClipboardCopy className="size-[15px]" aria-hidden="true" />
        {copyLabel}
      </Button>
    </div>
  );
}
