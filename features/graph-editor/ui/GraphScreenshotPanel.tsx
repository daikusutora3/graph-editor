"use client";

import { Check, ClipboardCopy, Download } from "lucide-react";
import type { CSSProperties } from "react";

import { useI18n } from "../i18n/I18nProvider";
import { cn } from "@/lib/utils";
import type {
  PngExportBackground,
  ScreenshotCopyState,
  ScreenshotDownloadState,
  ScreenshotPreview,
} from "./graph-io-types";
import type {
  PngExportLongEdgePreset,
  PngExportPaddingPreset,
} from "./graph-io-types";
import type { ThemeMode } from "./theme";

const LONG_EDGE_RANGE = {
  max: 3840,
  min: 480,
  step: 20,
} as const;
const PADDING_RANGE = {
  max: 160,
  min: 0,
  step: 4,
} as const;

type ScreenshotPanelProps = {
  effectiveBackground: PngExportBackground;
  screenshotCopyMessage: string;
  screenshotDownloadMessage: string;
  screenshotLongEdgePreset: PngExportLongEdgePreset;
  screenshotCustomLongEdgePx: number;
  screenshotPaddingPreset: PngExportPaddingPreset;
  screenshotCustomPaddingPx: number;
  screenshotPreview: ScreenshotPreview;
  solidBackground: "white" | "black";
  theme: ThemeMode;
  onScreenshotCustomLongEdgeChange: (longEdgePx: number) => void;
  onScreenshotBackgroundChange: (background: PngExportBackground) => void;
  onScreenshotCustomPaddingChange: (paddingPx: number) => void;
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
  solidBackground,
  theme,
  onScreenshotCustomLongEdgeChange,
  onScreenshotBackgroundChange,
  onScreenshotCustomPaddingChange,
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
      />
      <PaddingControl
        customPaddingPx={screenshotCustomPaddingPx}
        preset={screenshotPaddingPreset}
        onCustomPaddingChange={onScreenshotCustomPaddingChange}
      />

      <ScreenshotPreviewCard
        background={effectiveBackground}
        preview={screenshotPreview}
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
  const copyStatus =
    screenshotCopyState === "copied" || screenshotCopyState === "saved"
      ? "success"
      : screenshotCopyState === "blocked"
        ? "warning"
        : undefined;
  const copyLabel =
    screenshotCopyState === "copying"
      ? messages.common.copying
      : screenshotCopyState === "copied"
        ? messages.common.copied
        : screenshotCopyState === "saved"
          ? messages.common.saved
          : screenshotCopyState === "blocked"
            ? messages.common.failed
            : messages.common.copy;

  return (
    <div className="flex min-w-0 justify-end">
      <div className="flex min-w-0 items-center gap-2">
        <ScreenshotDownloadButton
          ariaLabel={
            screenshotDownloadState === "saving"
              ? messages.screenshot.downloading
              : screenshotDownloadState === "failed"
                ? messages.screenshot.downloadFailed
                : messages.screenshot.download
          }
          busy={screenshotDownloadState === "saving"}
          disabled={isGraphEmpty || screenshotDownloadState === "saving"}
          label={messages.screenshot.download}
          title={messages.screenshot.download}
          onClick={onDownloadScreenshot}
        />
        <ScreenshotCopyButton
          ariaLabel={
            screenshotCopyState === "copying"
              ? messages.common.copying
              : screenshotCopyState === "copied"
                ? messages.screenshot.copiedAria
                : screenshotCopyState === "saved"
                  ? messages.screenshot.savedAria
                  : screenshotCopyState === "blocked"
                    ? messages.screenshot.blockedAria
                    : messages.common.copy
          }
          busy={screenshotCopyState === "copying"}
          disabled={isGraphEmpty || screenshotCopyState === "copying"}
          label={copyLabel}
          status={copyStatus}
          onClick={onCopyScreenshot}
        />
      </div>
    </div>
  );
}

function LongEdgeControl({
  customLongEdgePx,
  preset,
  onCustomLongEdgeChange,
}: {
  customLongEdgePx: number;
  preset: PngExportLongEdgePreset;
  onCustomLongEdgeChange: (longEdgePx: number) => void;
}) {
  const { messages } = useI18n();

  return (
    <RangeScaleControl
      label={messages.screenshot.imageSize}
      max={LONG_EDGE_RANGE.max}
      min={LONG_EDGE_RANGE.min}
      name="screenshot-long-edge"
      step={LONG_EDGE_RANGE.step}
      value={resolveNumberPresetValue(preset, customLongEdgePx)}
      onChange={(nextValue) => {
        onCustomLongEdgeChange(nextValue);
      }}
    />
  );
}

function PaddingControl({
  customPaddingPx,
  preset,
  onCustomPaddingChange,
}: {
  customPaddingPx: number;
  preset: PngExportPaddingPreset;
  onCustomPaddingChange: (paddingPx: number) => void;
}) {
  const { messages } = useI18n();

  return (
    <RangeScaleControl
      label={messages.screenshot.padding}
      max={PADDING_RANGE.max}
      min={PADDING_RANGE.min}
      name="screenshot-padding"
      step={PADDING_RANGE.step}
      value={resolveNumberPresetValue(preset, customPaddingPx)}
      onChange={(nextValue) => {
        onCustomPaddingChange(nextValue);
      }}
    />
  );
}

function resolveNumberPresetValue<T extends number>(
  preset: T | "custom",
  customValue: number,
) {
  return preset === "custom" ? customValue : preset;
}

function RangeScaleControl({
  label,
  max,
  min,
  name,
  step,
  value,
  onChange,
}: {
  label: string;
  max: number;
  min: number;
  name: string;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  const currentValue = snapToStep(value, { max, min, step });
  const trackFillPercent = ((currentValue - min) / (max - min)) * 100;

  return (
    <fieldset className="grid min-w-0 gap-[var(--app-space-2)]">
      <legend className="sr-only">{label}</legend>
      <div className="flex min-h-5 items-center justify-between gap-[var(--app-space-2)]">
        <span className="gv-microcopy min-w-0 truncate">{label}</span>
        <output
          htmlFor={name}
          className="shrink-0 rounded-[var(--app-radius-sm)] bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[length:var(--app-text-micro)] leading-none font-bold text-[var(--text-dim)] shadow-[var(--app-shadow-card)]"
        >
          {currentValue}px
        </output>
      </div>
      <div className="grid min-w-0 gap-1.5 rounded-[var(--app-radius-sm)] bg-[var(--state-control-bg)] px-[var(--app-space-3)] py-[var(--app-space-2)]">
        <input
          type="range"
          name={name}
          min={min}
          max={max}
          step={step}
          value={currentValue}
          aria-label={label}
          onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
          className="gv-range-control"
          style={
            {
              "--gv-range-fill": `${trackFillPercent}%`,
            } as CSSProperties
          }
        />
        <div
          className="flex items-center justify-between text-[length:var(--app-text-micro)] leading-none font-[650] text-[var(--text-mute)]"
          aria-hidden
        >
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
    </fieldset>
  );
}

function snapToStep(
  value: number,
  { max, min, step }: { max: number; min: number; step: number },
) {
  const steps = Math.round((value - min) / step);
  return Math.min(max, Math.max(min, min + steps * step));
}

function ScreenshotPreviewCard({
  background,
  preview,
}: {
  background: PngExportBackground;
  preview: ScreenshotPreview;
}) {
  const { messages } = useI18n();
  const transparent = background === "transparent";
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
          <span className="rounded-[var(--app-radius-sm)] bg-[var(--surface)] px-2 py-1 font-mono text-[length:var(--app-text-micro)] leading-none font-bold text-[var(--text-mute)] shadow-[var(--app-shadow-card)]">
            {dimensions}
          </span>
        </div>
      </div>
      <div
        className={cn(
          "grid min-h-24 w-full place-items-center overflow-hidden rounded-[calc(var(--app-radius-sm)-1px)]",
          transparent && "gv-transparent-preview",
        )}
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

function ScreenshotDownloadButton({
  ariaLabel,
  busy = false,
  disabled,
  label,
  title,
  onClick,
}: {
  ariaLabel: string;
  busy?: boolean;
  disabled: boolean;
  label: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy}
      aria-label={ariaLabel}
      title={title}
      className={cn(
        "inline-flex h-9 w-40 max-w-[calc(100vw-9rem)] min-w-0 items-center justify-center gap-2 rounded-[var(--app-radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[length:var(--app-text-xs)] leading-[var(--app-leading-tight)] font-[700] text-[var(--text-dim)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--state-hover-bg)] hover:text-[var(--state-hover-text)] focus-visible:ring-2 focus-visible:ring-[var(--state-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--state-focus-ring-offset)] focus-visible:outline-none disabled:text-[var(--text-mute)] disabled:opacity-55",
      )}
    >
      <Download className="size-4 shrink-0" />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

function ScreenshotCopyButton({
  ariaLabel,
  busy = false,
  disabled,
  label,
  status,
  onClick,
}: {
  ariaLabel: string;
  busy?: boolean;
  disabled: boolean;
  label: string;
  status?: "success" | "warning";
  onClick: () => void;
}) {
  const settled = status === "success" || status === "warning";
  const toneClass =
    status === "success"
      ? "border-[var(--ok)] bg-[var(--ok-soft)] font-[800] text-[var(--ok)] hover:border-[var(--ok)] hover:bg-[var(--ok-soft)] hover:text-[var(--ok)]"
      : status === "warning"
        ? "border-[var(--warn)] bg-[var(--warn-soft)] font-[800] text-[var(--warn)] hover:border-[var(--warn)] hover:bg-[var(--warn-soft)] hover:text-[var(--warn)]"
        : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-dim)] hover:border-[var(--border-strong)] hover:bg-[var(--state-hover-bg)] hover:text-[var(--state-hover-text)]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy}
      aria-label={ariaLabel}
      data-status={status}
      className={cn(
        "inline-flex h-9 w-32 max-w-[calc(100vw-7rem)] min-w-0 items-center justify-center gap-2 rounded-[var(--app-radius-sm)] border px-3 text-[length:var(--app-text-xs)] leading-[var(--app-leading-tight)] font-[700] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--state-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--state-focus-ring-offset)] focus-visible:outline-none disabled:text-[var(--text-mute)] disabled:opacity-60",
        toneClass,
      )}
    >
      {settled ? (
        <Check className="size-4 shrink-0" strokeWidth={2.5} />
      ) : (
        <ClipboardCopy className="size-4 shrink-0" />
      )}
      <span className="min-w-0 truncate">{label}</span>
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
