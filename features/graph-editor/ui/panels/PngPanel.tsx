"use client";

import { ClipboardCopy, Download } from "lucide-react";

import {
  Button,
  ControlRow,
  Notice,
  PanelActions,
  Segment,
  Slider,
} from "@/components/ui/controls";
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
import { PngDimensionInput } from "./PngDimensionInput";
import { surface, textStyle } from "@/components/ui/surfaces";

const LONG_EDGE_STEP = 20;
const PADDING_STEP = 4;

type PngPanelBodyProps = {
  background: PngExportBackground;
  canvasHeightPx: number;
  canvasWidthPx: number;
  longEdgePx: number;
  mobile: boolean;
  notice: string;
  paddingPx: number;
  preview: ScreenshotPreview;
  scope: PngExportScope;
  solidBackground: "white" | "black";
  onBackgroundChange: (background: PngExportBackground) => void;
  onCanvasHeightChange: (value: number) => void;
  onCanvasWidthChange: (value: number) => void;
  onLongEdgeChange: (value: number) => void;
  onPaddingChange: (value: number) => void;
  onScopeChange: (scope: PngExportScope) => void;
};

export function PngPanelBody({
  background,
  canvasHeightPx,
  canvasWidthPx,
  longEdgePx,
  mobile,
  notice,
  paddingPx,
  preview,
  scope,
  solidBackground,
  onBackgroundChange,
  onCanvasHeightChange,
  onCanvasWidthChange,
  onLongEdgeChange,
  onPaddingChange,
  onScopeChange,
}: PngPanelBodyProps) {
  const { messages } = useI18n();
  const segmentSize = mobile ? "md" : "sm";
  const transparent = background === "transparent";
  const ready = preview.state === "ready" && preview.width && preview.height;
  const dimensions = ready ? `${preview.width} × ${preview.height} px` : null;
  const previewHeight = ready
    ? Math.min(220, Math.round((340 * preview.height!) / preview.width!))
    : 160;

  return (
    <>
      <section
        aria-label={messages.screenshot.preview}
        className={cn(surface.inset, "relative shrink-0 overflow-hidden")}
      >
        <div
          className={cn(
            "relative grid w-full place-items-center overflow-hidden",
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
        {dimensions ? (
          <span
            className={cn(
              surface.floating,
              textStyle.meta,
              "absolute right-2 bottom-2 rounded-md px-1.5 py-0.5",
            )}
          >
            {dimensions}
          </span>
        ) : null}
      </section>
      <div className="flex min-w-0 flex-col gap-3">
        <ControlRow label={messages.screenshot.scope} layout="stacked">
          <Segment
            label={messages.screenshot.scope}
            size={segmentSize}
            value={scope === "viewport" ? "viewport" : "full"}
            options={[
              { label: messages.chrome.pngScopeFull, value: "full" },
              { label: messages.chrome.pngScopeView, value: "viewport" },
            ]}
            onChange={onScopeChange}
          />
        </ControlRow>
        <ControlRow label={messages.screenshot.background} layout="stacked">
          <Segment
            label={messages.screenshot.background}
            size={segmentSize}
            value={background}
            options={[
              {
                label:
                  solidBackground === "black"
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
        </ControlRow>

        {scope !== "viewport" ? (
          <ControlRow label={messages.screenshot.imageSize} layout="stacked">
            <Segment
              label={messages.screenshot.imageSize}
              size={segmentSize}
              value={scope}
              options={[
                { label: messages.screenshot.fixedLongEdge, value: "full" },
                { label: messages.screenshot.natural, value: "natural" },
                {
                  label: messages.screenshot.naturalFixed,
                  value: "natural-fixed",
                },
              ]}
              onChange={onScopeChange}
            />
          </ControlRow>
        ) : null}

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

        {scope === "natural-fixed" ? (
          <div className="grid grid-cols-2 gap-2.5">
            {(
              [
                [
                  "width",
                  messages.screenshot.canvasWidth,
                  canvasWidthPx,
                  onCanvasWidthChange,
                ],
                [
                  "height",
                  messages.screenshot.canvasHeight,
                  canvasHeightPx,
                  onCanvasHeightChange,
                ],
              ] as const
            ).map(([dimension, label, value, onChange]) => (
              <PngDimensionInput
                key={dimension}
                label={label}
                value={value}
                onChange={onChange}
              />
            ))}
          </div>
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
      </div>

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
    <PanelActions>
      <Button
        aria-busy={downloadState === "saving"}
        disabled={isGraphEmpty || downloadState === "saving"}
        size="lg"
        wrap
        variant={isGraphEmpty ? "disabled" : "secondary"}
        onClick={onDownload}
      >
        <Download className="size-icon-sm" aria-hidden="true" />
        {downloadState === "saving"
          ? messages.chrome.pngSaving
          : messages.chrome.pngSave}
      </Button>
      <Button
        aria-busy={copyState === "copying"}
        disabled={isGraphEmpty || copyState === "copying"}
        size="lg"
        wrap
        variant={copyVariant}
        onClick={onCopy}
      >
        <ClipboardCopy className="size-icon-sm" aria-hidden="true" />
        {copyLabel}
      </Button>
    </PanelActions>
  );
}
