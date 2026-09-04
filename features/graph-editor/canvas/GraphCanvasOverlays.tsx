"use client";

import { Maximize2, Minus, Plus } from "lucide-react";
import type { CSSProperties, MutableRefObject, RefObject } from "react";
import { useEffect, useRef, useState } from "react";

import { useI18n } from "../i18n/I18nProvider";
import { IconButton, focusRing } from "../ui/primitives";
import type { NodeHitbox } from "../adapters/cytoscape/graph-canvas-hitboxes";
import type { InlineEditTarget, RenderedPoint } from "./graph-canvas-types";

type ZoomControlsProps = {
  disabled: boolean;
  maxZoom: number;
  minZoom: number;
  zoomPercent: number;
  zoomStep: number;
  onFitView: () => void;
  onResetZoom: () => void;
  onZoom: (delta: number) => void;
};

export function ZoomControls({
  disabled,
  maxZoom,
  minZoom,
  zoomPercent,
  zoomStep,
  onFitView,
  onResetZoom,
  onZoom,
}: ZoomControlsProps) {
  const { messages } = useI18n();
  const minZoomPercent = Math.round(minZoom * 100);
  const maxZoomPercent = Math.round(maxZoom * 100);
  const zoomOutDisabled = disabled || zoomPercent <= minZoomPercent;
  const zoomInDisabled = disabled || zoomPercent >= maxZoomPercent;

  return (
    <div
      className="ge-panel touch:h-[52px] touch:gap-1 touch:rounded-[14px] pointer-events-auto relative z-40 flex h-12 items-center gap-0.5 rounded-xl px-1 backdrop-blur-[12px]"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <IconButton
        disabled={zoomOutDisabled}
        label={messages.canvas.zoomOut}
        size="lg"
        tooltipSide="top"
        onClick={() => onZoom(-zoomStep)}
      >
        <Minus className="size-icon-sm" />
      </IconButton>
      <button
        type="button"
        aria-label={messages.canvas.resetZoom(zoomPercent)}
        data-tooltip={messages.canvas.resetZoom(zoomPercent)}
        data-tooltip-side="top"
        disabled={disabled}
        onClick={onResetZoom}
        className={[
          "touch:h-11 touch:min-w-14 touch:rounded-lg text-control grid h-10 min-w-[60px] place-items-center rounded-lg bg-transparent px-2 font-mono font-semibold text-[var(--text-2)] tabular-nums transition-colors hover:bg-[var(--fill)] disabled:cursor-default disabled:text-[var(--faint)] disabled:hover:bg-transparent",
          focusRing,
        ].join(" ")}
      >
        {zoomPercent}%
      </button>
      <IconButton
        disabled={zoomInDisabled}
        label={messages.canvas.zoomIn}
        size="lg"
        tooltipSide="top"
        onClick={() => onZoom(zoomStep)}
      >
        <Plus className="size-icon-sm" />
      </IconButton>
      <span aria-hidden="true" className="mx-1 h-6 w-px bg-[var(--line)]" />
      <IconButton
        disabled={disabled}
        label={messages.canvas.fitGraphTitle}
        size="lg"
        tooltipSide="top"
        onClick={onFitView}
      >
        <Maximize2 className="size-icon-sm" />
      </IconButton>
    </div>
  );
}

export function FitToViewButton({ onFitView }: { onFitView: () => void }) {
  const { messages } = useI18n();

  return (
    <IconButton
      className="ge-panel ge-pop pointer-events-auto rounded-[14px] backdrop-blur-[12px]"
      label={messages.canvas.fitGraphTitle}
      tooltipSide="top"
      onClick={onFitView}
    >
      <Maximize2 className="size-icon-lg" aria-hidden="true" />
    </IconButton>
  );
}

/** Transient zoom readout for touch devices, where there is no zoom pill. */
export function ZoomBadge({
  visible,
  zoomPercent,
}: {
  visible: boolean;
  zoomPercent: number;
}) {
  const [shown, setShown] = useState(false);
  const initialZoomRef = useRef(zoomPercent);

  useEffect(() => {
    if (!visible || zoomPercent === initialZoomRef.current) {
      return;
    }

    initialZoomRef.current = zoomPercent;
    setShown(true);
    const timeoutId = window.setTimeout(() => setShown(false), 1200);

    return () => window.clearTimeout(timeoutId);
  }, [visible, zoomPercent]);

  if (!visible || !shown) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[68px] z-[60] flex justify-center">
      <span
        role="status"
        aria-live="polite"
        className="ge-pop inline-flex h-[30px] items-center rounded-full bg-[var(--primary)] px-3 font-mono text-xs font-semibold text-[var(--primary-text)] tabular-nums shadow-[var(--shadow)]"
      >
        {zoomPercent}%
      </span>
    </div>
  );
}

type EdgeDraftLineProps = {
  hasError: boolean;
  segment: { source: RenderedPoint; target: RenderedPoint } | null;
  showTargetMarker: boolean;
};

export function EdgeDraftLine({
  hasError,
  segment,
  showTargetMarker,
}: EdgeDraftLineProps) {
  if (!segment) {
    return null;
  }

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[15] h-full w-full"
      aria-hidden="true"
    >
      <line
        x1={segment.source.x}
        y1={segment.source.y}
        x2={segment.target.x}
        y2={segment.target.y}
        stroke={hasError ? "var(--danger)" : "var(--accent)"}
        strokeWidth="2.5"
        strokeDasharray="8 7"
        strokeLinecap="round"
      />
      {showTargetMarker ? (
        <circle
          cx={segment.target.x}
          cy={segment.target.y}
          r="5"
          fill={hasError ? "var(--danger-fill)" : "var(--accent-fill)"}
          stroke={hasError ? "var(--danger)" : "var(--accent)"}
          strokeWidth="1.5"
        />
      ) : null}
    </svg>
  );
}

export function EditFeedbackNodes({
  feedbackId,
  nodes,
}: {
  feedbackId: number | null;
  nodes: NodeHitbox[];
}) {
  return (
    <>
      {nodes.map((node) => (
        <span
          key={`${feedbackId}:${node.id}`}
          className="ge-edit-feedback-node pointer-events-none absolute z-[18] size-16 rounded-full border-2"
          style={{ left: node.x, top: node.y }}
        />
      ))}
    </>
  );
}

type InlineEditFormProps = {
  edit: InlineEditTarget | null;
  inputRef: RefObject<HTMLInputElement | null>;
  isComposingRef: MutableRefObject<boolean>;
  position: RenderedPoint | null;
  style?: CSSProperties;
  onCancel: () => void;
  onCommit: () => void;
  onValueChange: (value: string) => void;
};

export function InlineEditForm({
  edit,
  inputRef,
  isComposingRef,
  position,
  style,
  onCancel,
  onCommit,
  onValueChange,
}: InlineEditFormProps) {
  const { messages } = useI18n();

  if (!edit || !position) {
    return null;
  }

  return (
    <form
      className={[
        "ge-inline-edit-form pointer-events-auto absolute z-40 -translate-x-1/2 -translate-y-1/2",
        edit.kind === "node-label"
          ? "ge-inline-edit-form-node"
          : "ge-inline-edit-form-edge",
      ].join(" ")}
      style={{
        left: position.x,
        top: position.y,
        ...style,
      }}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onSubmit={(event) => {
        event.preventDefault();
        if (isComposingRef.current) {
          return;
        }
        onCommit();
      }}
    >
      <input
        ref={inputRef}
        name={`graph-${edit.kind}`}
        value={edit.value}
        aria-label={
          edit.kind === "node-label"
            ? messages.canvas.editNodeLabel
            : edit.kind === "edge-weight"
              ? messages.canvas.editEdgeWeight
              : messages.canvas.editEdgeLabel
        }
        aria-invalid={Boolean(edit.error)}
        placeholder={
          edit.kind === "node-label"
            ? messages.canvas.nodeLabelPlaceholder
            : undefined
        }
        autoComplete="off"
        inputMode={edit.kind === "edge-weight" ? "decimal" : "text"}
        onChange={(event) => onValueChange(event.target.value)}
        onBlur={onCommit}
        onCompositionStart={() => {
          isComposingRef.current = true;
        }}
        onCompositionEnd={() => {
          isComposingRef.current = false;
        }}
        onKeyDown={(event) => {
          event.stopPropagation();

          if (
            isComposingRef.current ||
            event.nativeEvent.isComposing ||
            event.nativeEvent.keyCode === 229
          ) {
            return;
          }

          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
            return;
          }

          if (event.key === "Enter") {
            event.preventDefault();
            onCommit();
          }
        }}
        className={[
          "ge-inline-edit-input",
          edit.kind === "node-label"
            ? "ge-inline-edit-input-node"
            : "ge-inline-edit-input-edge",
          edit.error
            ? "ge-inline-edit-input-error"
            : "ge-inline-edit-input-valid",
        ].join(" ")}
      />
      {edit.error ? (
        <div
          role="alert"
          className="ge-inline-edit-error absolute top-full left-1/2 mt-1 max-w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 text-center"
        >
          {messages.canvas.inlineEditErrors[edit.error]}
        </div>
      ) : null}
    </form>
  );
}
