"use client";

import { Check, ClipboardCopy, Download, RefreshCw } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { useI18n } from "../i18n/I18nProvider";
import { cn } from "@/lib/utils";
import type {
  PngExportBackground,
  PngExportLongEdgePreset,
  PngExportPaddingPreset,
  ScreenshotCopyState,
  ScreenshotDownloadState,
  ScreenshotPreview,
} from "./graph-io-types";
import {
  MAX_LONG_EDGE_PX,
  MAX_PADDING_PX,
  MIN_LONG_EDGE_PX,
  MIN_PADDING_PX,
  PNG_EXPORT_LONG_EDGE_PRESETS,
  PNG_EXPORT_PADDING_PRESETS,
} from "./graph-io-types";
import type { ThemeMode } from "./theme";

type ScreenshotPanelProps = {
  effectiveBackground: PngExportBackground;
  screenshotCopyMessage: string;
  screenshotDownloadMessage: string;
  screenshotLongEdgePreset: PngExportLongEdgePreset;
  screenshotCustomLongEdgePx: number;
  screenshotPaddingPreset: PngExportPaddingPreset;
  screenshotCustomPaddingPx: number;
  screenshotPreview: ScreenshotPreview;
  screenshotPreviewStale: boolean;
  solidBackground: "white" | "black";
  theme: ThemeMode;
  onRefreshPreview: () => void;
  onScreenshotCustomLongEdgeChange: (longEdgePx: number) => void;
  onScreenshotBackgroundChange: (background: PngExportBackground) => void;
  onScreenshotLongEdgePresetChange: (preset: PngExportLongEdgePreset) => void;
  onScreenshotCustomPaddingChange: (paddingPx: number) => void;
  onScreenshotPaddingPresetChange: (preset: PngExportPaddingPreset) => void;
};

type ScreenshotFooterProps = {
  isGraphEmpty: boolean;
  screenshotCopyState: ScreenshotCopyState;
  screenshotDownloadState: ScreenshotDownloadState;
  onCopyScreenshot: () => void;
  onDownloadScreenshot: () => void;
};

export function ScreenshotTitle() {
  const { messages } = useI18n();

  return messages.screenshot.title;
}

export function ScreenshotPanel({
  effectiveBackground,
  screenshotCopyMessage,
  screenshotDownloadMessage,
  screenshotLongEdgePreset,
  screenshotCustomLongEdgePx,
  screenshotPaddingPreset,
  screenshotCustomPaddingPx,
  screenshotPreview,
  screenshotPreviewStale,
  solidBackground,
  theme,
  onRefreshPreview,
  onScreenshotCustomLongEdgeChange,
  onScreenshotBackgroundChange,
  onScreenshotLongEdgePresetChange,
  onScreenshotCustomPaddingChange,
  onScreenshotPaddingPresetChange,
}: ScreenshotPanelProps) {
  const { messages } = useI18n();

  return (
    <div className="flex flex-col gap-[var(--app-space-3)]">
      <OptionGroup
        label={messages.screenshot.background}
        value={effectiveBackground}
        options={[
          {
            label:
              theme === "dark"
                ? messages.screenshot.black
                : messages.screenshot.white,
            value: solidBackground,
          },
          { label: messages.screenshot.transparent, value: "transparent" },
        ]}
        onChange={onScreenshotBackgroundChange}
      />
      <LongEdgeControl
        customLongEdgePx={screenshotCustomLongEdgePx}
        preset={screenshotLongEdgePreset}
        onCustomLongEdgeChange={onScreenshotCustomLongEdgeChange}
        onPresetChange={onScreenshotLongEdgePresetChange}
      />
      <PaddingControl
        customPaddingPx={screenshotCustomPaddingPx}
        preset={screenshotPaddingPreset}
        onCustomPaddingChange={onScreenshotCustomPaddingChange}
        onPresetChange={onScreenshotPaddingPresetChange}
      />

      <ScreenshotPreviewCard
        preview={screenshotPreview}
        stale={screenshotPreviewStale}
        onRefresh={onRefreshPreview}
      />

      {screenshotCopyMessage || screenshotDownloadMessage ? (
        <div className="rounded-[var(--app-radius-sm)] bg-[var(--warn-soft)] px-[var(--app-space-3)] py-[var(--app-space-2)] text-[length:var(--app-text-xs)] leading-[var(--app-leading-tight)] font-[650] text-[var(--warn)]">
          {screenshotCopyMessage || screenshotDownloadMessage}
        </div>
      ) : null}
    </div>
  );
}

export function ScreenshotFooter({
  isGraphEmpty,
  screenshotCopyState,
  screenshotDownloadState,
  onCopyScreenshot,
  onDownloadScreenshot,
}: ScreenshotFooterProps) {
  const { messages } = useI18n();

  return (
    <div className="flex flex-wrap items-center justify-end gap-[var(--app-space-2)]">
      <ScreenshotActionButton
        icon={
          screenshotDownloadState === "saved" ? (
            <Check className="size-4" />
          ) : (
            <Download className="size-4" />
          )
        }
        status={
          screenshotDownloadState === "saved"
            ? "success"
            : screenshotDownloadState === "failed"
              ? "warning"
              : undefined
        }
        disabled={isGraphEmpty || screenshotDownloadState === "saving"}
        onClick={onDownloadScreenshot}
      >
        {screenshotDownloadState === "saving"
          ? messages.screenshot.downloading
          : screenshotDownloadState === "saved"
            ? messages.screenshot.downloaded
            : screenshotDownloadState === "failed"
              ? messages.common.failed
              : messages.screenshot.download}
      </ScreenshotActionButton>
      <ScreenshotActionButton
        icon={
          screenshotCopyState === "copied" ||
          screenshotCopyState === "saved" ? (
            <Check className="size-4" />
          ) : (
            <ClipboardCopy className="size-4" />
          )
        }
        status={
          screenshotCopyState === "copied" || screenshotCopyState === "saved"
            ? "success"
            : screenshotCopyState === "blocked"
              ? "warning"
              : undefined
        }
        disabled={isGraphEmpty || screenshotCopyState === "copying"}
        onClick={onCopyScreenshot}
      >
        {screenshotCopyState === "copying"
          ? messages.common.copying
          : screenshotCopyState === "copied"
            ? messages.common.copied
            : screenshotCopyState === "saved"
              ? messages.common.saved
              : screenshotCopyState === "blocked"
                ? messages.common.failed
                : messages.common.copy}
      </ScreenshotActionButton>
    </div>
  );
}

function LongEdgeControl({
  customLongEdgePx,
  preset,
  onCustomLongEdgeChange,
  onPresetChange,
}: {
  customLongEdgePx: number;
  preset: PngExportLongEdgePreset;
  onCustomLongEdgeChange: (longEdgePx: number) => void;
  onPresetChange: (preset: PngExportLongEdgePreset) => void;
}) {
  const { messages } = useI18n();

  return (
    <NumberPresetControl
      customLabel={messages.screenshot.longEdgeCustom}
      customValue={customLongEdgePx}
      label={messages.screenshot.imageSize}
      max={MAX_LONG_EDGE_PX}
      min={MIN_LONG_EDGE_PX}
      name="screenshot-long-edge"
      preset={preset}
      presets={PNG_EXPORT_LONG_EDGE_PRESETS}
      step={64}
      onCustomChange={onCustomLongEdgeChange}
      onPresetChange={onPresetChange}
    />
  );
}

function PaddingControl({
  customPaddingPx,
  preset,
  onCustomPaddingChange,
  onPresetChange,
}: {
  customPaddingPx: number;
  preset: PngExportPaddingPreset;
  onCustomPaddingChange: (paddingPx: number) => void;
  onPresetChange: (preset: PngExportPaddingPreset) => void;
}) {
  const { messages } = useI18n();

  return (
    <NumberPresetControl
      customLabel={messages.screenshot.longEdgeCustom}
      customValue={customPaddingPx}
      label={messages.screenshot.padding}
      max={MAX_PADDING_PX}
      min={MIN_PADDING_PX}
      name="screenshot-padding"
      preset={preset}
      presets={PNG_EXPORT_PADDING_PRESETS}
      step={8}
      onCustomChange={onCustomPaddingChange}
      onPresetChange={onPresetChange}
    />
  );
}

function NumberPresetControl<T extends number>({
  customLabel,
  customValue,
  label,
  max,
  min,
  name,
  preset,
  presets,
  step,
  onCustomChange,
  onPresetChange,
}: {
  customLabel: string;
  customValue: number;
  label: string;
  max: number;
  min: number;
  name: string;
  preset: T | "custom";
  presets: readonly T[];
  step: number;
  onCustomChange: (value: number) => void;
  onPresetChange: (preset: T | "custom") => void;
}) {
  return (
    <fieldset className="grid min-w-0 gap-[var(--app-space-2)]">
      <legend className="gv-microcopy">{label}</legend>
      <div className="gv-segment" role="radiogroup" aria-label={label}>
        {presets.map((value) => (
          <label key={value} className="gv-segment-button">
            <input
              className="sr-only"
              type="radio"
              name={name}
              value={value}
              checked={preset === value}
              aria-label={`${label}: ${value}px`}
              onChange={() => onPresetChange(value)}
            />
            <span className="block truncate">{value}px</span>
          </label>
        ))}
        <label className="gv-segment-button">
          <input
            className="sr-only"
            type="radio"
            name={name}
            value="custom"
            checked={preset === "custom"}
            aria-label={`${label}: ${customLabel}`}
            onChange={() => onPresetChange("custom")}
          />
          <span className="block truncate">{customLabel}</span>
        </label>
      </div>
      {preset === "custom" ? (
        <label className="flex min-w-0 items-center gap-[var(--app-space-2)]">
          <span className="gv-microcopy shrink-0">{label}</span>
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={customValue}
            onChange={(event) =>
              onCustomChange(event.currentTarget.valueAsNumber)
            }
            className="h-8 min-w-0 flex-1 rounded-[var(--app-radius-sm)] border border-transparent bg-[var(--state-control-bg)] px-[var(--app-space-3)] font-mono text-[length:var(--app-text-xs)] leading-none font-bold text-[var(--text-dim)] focus-visible:ring-2 focus-visible:ring-[var(--state-focus-ring)] focus-visible:outline-none"
          />
          <span className="shrink-0 text-[length:var(--app-text-xs)] font-bold text-[var(--text-mute)]">
            px
          </span>
        </label>
      ) : null}
    </fieldset>
  );
}

function ScreenshotPreviewCard({
  preview,
  stale,
  onRefresh,
}: {
  preview: ScreenshotPreview;
  stale: boolean;
  onRefresh: () => void;
}) {
  const { messages } = useI18n();
  const dimensions =
    preview.state === "ready" && preview.width && preview.height
      ? `${preview.width} x ${preview.height} px`
      : messages.screenshot.previewNoDimensions;
  const previewStyle: CSSProperties = {
    aspectRatio:
      preview.state === "ready" && preview.width && preview.height
        ? `${preview.width} / ${preview.height}`
        : "16 / 9",
  };

  return (
    <section
      className="relative flex min-w-0 flex-col gap-[var(--app-space-2)] overflow-hidden rounded-[var(--app-radius-sm)] bg-[var(--state-track-bg)] p-[var(--app-space-2)]"
      aria-label={messages.screenshot.preview}
    >
      <div className="flex min-h-5 items-center justify-between gap-[var(--app-space-2)]">
        <span className="gv-microcopy min-w-0 truncate">
          {messages.screenshot.preview}
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          {stale ? (
            <button
              type="button"
              className="inline-flex h-6 items-center gap-1 rounded-[var(--app-radius-sm)] bg-[var(--accent-2-soft)] px-2 text-[length:var(--app-text-micro)] leading-none font-bold text-[var(--accent-2-strong)] hover:bg-[var(--state-control-hover-bg)] focus-visible:ring-2 focus-visible:ring-[var(--state-focus-ring)] focus-visible:outline-none"
              onClick={onRefresh}
            >
              <RefreshCw className="size-3" />
              <span>{messages.screenshot.previewRefresh}</span>
            </button>
          ) : null}
          <span className="rounded-[var(--app-radius-sm)] bg-[var(--surface)] px-2 py-1 font-mono text-[length:var(--app-text-micro)] leading-none font-bold text-[var(--text-mute)] shadow-[var(--app-shadow-card)]">
            {dimensions}
          </span>
        </div>
      </div>
      <div
        className="grid min-h-24 w-full place-items-center overflow-hidden"
        style={previewStyle}
      >
        {preview.state === "ready" && preview.url ? (
          <img
            src={preview.url}
            alt={messages.screenshot.previewAlt}
            className="h-full w-full object-contain"
            draggable={false}
          />
        ) : (
          <span className="px-[var(--app-space-3)] text-center text-[length:var(--app-text-xs)] leading-[var(--app-leading-tight)] font-[650] text-[var(--text-mute)]">
            {preview.state === "loading"
              ? messages.screenshot.previewLoading
              : preview.state === "failed"
                ? messages.screenshot.previewFailed
                : messages.screenshot.previewEmpty}
          </span>
        )}
      </div>
    </section>
  );
}

function ScreenshotActionButton({
  children,
  disabled,
  icon,
  status,
  onClick,
}: {
  children: string;
  disabled: boolean;
  icon: ReactNode;
  status?: "success" | "warning";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-status={status}
      className={cn(
        "inline-flex h-8 min-w-[4.75rem] items-center justify-center gap-1.5 rounded-[var(--app-radius-sm)] border border-[color-mix(in_srgb,var(--divider)_72%,transparent)] bg-[var(--surface)] px-[var(--app-space-3)] text-[length:var(--app-text-xs)] leading-[var(--app-leading-tight)] font-[650] text-[var(--text-dim)] shadow-[var(--app-shadow-card)] transition-colors hover:border-[var(--divider)] hover:bg-[var(--state-control-hover-bg)] hover:text-[var(--state-hover-text)] focus-visible:ring-2 focus-visible:ring-[var(--state-focus-ring)] focus-visible:outline-none disabled:border-transparent disabled:bg-[var(--state-control-bg)] disabled:text-[var(--text-mute)] disabled:opacity-70 disabled:shadow-none",
        status === "success" &&
          "border-transparent bg-[var(--ok-soft)] text-[var(--ok)] hover:bg-[var(--ok-soft)] hover:text-[var(--ok)]",
        status === "warning" &&
          "border-transparent bg-[var(--warn-soft)] text-[var(--warn)] hover:bg-[var(--warn-soft)] hover:text-[var(--warn)]",
      )}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

function OptionGroup<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { label: string; value: T }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="grid min-w-0 gap-[var(--app-space-2)]">
      <legend className="gv-microcopy">{label}</legend>
      <div className="gv-segment" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <label key={String(option.value)} className="gv-segment-button">
            <input
              className="sr-only"
              type="radio"
              name={`screenshot-${label}`}
              value={String(option.value)}
              checked={value === option.value}
              aria-label={`${label}: ${option.label}`}
              onChange={() => onChange(option.value)}
            />
            <span className="block truncate">{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
