import type { CSSProperties } from "react";

import { isEditorShortcutBlockedTarget } from "../adapters/browser/shortcut-targets";
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

export function inlineEditCssProperties({
  edit,
  maxZoom,
  minZoom,
  zoomPercent,
  compositionText,
}: {
  edit: InlineEditTarget;
  maxZoom: number;
  minZoom: number;
  zoomPercent: number;
  compositionText: string;
}): CSSProperties {
  const zoom = clamp(zoomPercent / 100, minZoom, maxZoom);
  const textUnits = estimateInlineEditTextUnits(
    compositionText ? `${edit.value}${compositionText}` : edit.value,
  );
  const width =
    edit.kind === "node-label"
      ? `max(calc(var(--app-canvas-node-size) * var(--gv-inline-edit-zoom) - 0.625rem), calc(${textUnits}ch + 0.75rem))`
      : `max(calc(1.5rem * var(--gv-inline-edit-zoom)), calc(${textUnits}ch + 0.875rem))`;

  return {
    width,
    "--gv-inline-edit-zoom": String(zoom),
  } as CSSProperties;
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
