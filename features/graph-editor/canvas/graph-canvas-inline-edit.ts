import type { CSSProperties } from "react";

import { isEditorShortcutBlockedTarget } from "../adapters/browser/shortcut-targets";
import type { GraphColor } from "../core/graph/model";
import type { InlineEditTarget } from "./graph-canvas-types";

export function isInlineEditStartShortcut(event: KeyboardEvent) {
  if (
    event.repeat ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    event.shiftKey ||
    event.isComposing ||
    event.keyCode === 229
  ) {
    return false;
  }

  return event.key === "Enter" || event.key === "F2";
}

export const isCanvasShortcutBlockedTarget = isEditorShortcutBlockedTarget;

/** Horizontal padding of node pills; must match NODE_LABEL_PADDING in the adapter. */
const NODE_LABEL_PADDING = 14;
/** Room for the caret so the last glyph never touches the edge. */
const CARET_ROOM = 4;

let measureContext: CanvasRenderingContext2D | null | undefined;

function measureInlineEditText(text: string, font: string): number {
  if (measureContext === undefined) {
    measureContext =
      typeof document === "undefined"
        ? null
        : document.createElement("canvas").getContext("2d");
  }

  if (!measureContext) {
    return estimateInlineEditTextUnits(text) * 8;
  }

  measureContext.font = font;
  return measureContext.measureText(text).width;
}

function canvasCssValue(name: string, fallback: string): string {
  if (typeof document === "undefined") {
    return fallback;
  }

  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback
  );
}

function canvasCssPx(name: string, fallback: number): number {
  const value = canvasCssValue(name, `${fallback}px`);
  const parsed = parseFloat(value);

  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return value.endsWith("rem") ? parsed * 16 : parsed;
}

/**
 * Sizes the inline editor so it matches the rendered label pixel for pixel:
 * same font, same padding, same minimum size, scaled by the current zoom.
 */
export function inlineEditCssProperties({
  edit,
  maxZoom,
  minZoom,
  nodeColor,
  zoomPercent,
}: {
  edit: InlineEditTarget;
  maxZoom: number;
  minZoom: number;
  nodeColor?: GraphColor;
  zoomPercent: number;
}): CSSProperties {
  const zoom = clamp(zoomPercent / 100, minZoom, maxZoom);
  const fontFamily = canvasCssValue("--canvas-font", "system-ui, sans-serif");
  const isNode = edit.kind === "node-label";
  const fontSize =
    canvasCssPx(
      isNode ? "--canvas-node-font" : "--canvas-edge-font",
      isNode ? 16 : 12,
    ) * zoom;
  const textWidth = measureInlineEditText(
    edit.value,
    `600 ${fontSize}px ${fontFamily}`,
  );
  const padding =
    (isNode ? NODE_LABEL_PADDING : canvasCssPx("--canvas-label-padding", 5)) *
    zoom;
  const minWidth = isNode ? canvasCssPx("--canvas-node-size", 48) * zoom : 0;
  const width = Math.max(
    minWidth,
    Math.ceil(textWidth + padding * 2 + CARET_ROOM),
  );
  const colorVars: Record<string, string | undefined> =
    isNode && nodeColor && nodeColor !== "paper"
      ? {
          "--ge-edit-bg": `var(--canvas-node-${nodeColor})`,
          "--ge-edit-text":
            nodeColor === "black"
              ? "#f8fafc"
              : nodeColor === "white"
                ? "#111827"
                : undefined,
          "--ge-edit-border":
            nodeColor === "black" ? "var(--canvas-edge)" : undefined,
        }
      : {};

  const style: Record<string, string | number | undefined> = {
    maxWidth: "calc(100vw - 2rem)",
    width,
    "--ge-inline-edit-zoom": String(zoom),
    "--ge-inline-edit-padding": `${padding}px`,
    ...colorVars,
  };

  return style as CSSProperties;
}

function estimateInlineEditTextUnits(text: string): number {
  let units = 0;

  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;

    if (codePoint === 0x200d || (codePoint >= 0xfe00 && codePoint <= 0xfe0f)) {
      continue;
    }

    units += isWideInlineEditCodePoint(codePoint) ? 2.25 : 1;
  }

  return Math.max(units, 1);
}

function isWideInlineEditCodePoint(codePoint: number): boolean {
  return (
    codePoint >= 0x1100 &&
    (codePoint <= 0x115f ||
      codePoint === 0x2329 ||
      codePoint === 0x232a ||
      (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f) ||
      (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
      (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
      (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
      (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
      (codePoint >= 0xff00 && codePoint <= 0xff60) ||
      (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
      (codePoint >= 0x1f300 && codePoint <= 0x1faff) ||
      (codePoint >= 0x20000 && codePoint <= 0x3fffd))
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
