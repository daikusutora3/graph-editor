"use client";

import { Maximize2, Minus, Plus } from "lucide-react";
import type { CSSProperties, MutableRefObject, RefObject } from "react";

import { useI18n } from "../i18n/I18nProvider";
import { IconButton, focusRing } from "../ui/primitives";
import type { NodeHitbox } from "../adapters/cytoscape/graph-canvas-hitboxes";
import type { InlineEditTarget, RenderedPoint } from "./graph-canvas-types";

type ZoomControlsProps = {
  disabled: boolean;
  maxZoom: number;
  minZoom: number;
  offsetForMobile: boolean;
  zoomPercent: number;
  zoomStep: number;
  onFitView: () => void;
  onResetZoom: () => void;
  onZoom: (delta: number) => void;
};

type CanvasPointer = {
  clientX: number;
  clientY: number;
};

export function ZoomControls({
  disabled,
  maxZoom,
  minZoom,
  offsetForMobile,
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
      className={[
        "ge-panel absolute right-6 z-40 flex h-9 items-center gap-0.5 rounded-[10px] px-[3px] backdrop-blur-[12px]",
        offsetForMobile ? "bottom-[92px]" : "bottom-6",
      ].join(" ")}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <IconButton
        disabled={zoomOutDisabled}
        label={messages.canvas.zoomOut}
        size={30}
        onClick={() => onZoom(-zoomStep)}
      >
        <Minus className="size-[15px]" />
      </IconButton>
      <button
        type="button"
        aria-label={messages.canvas.resetZoom(zoomPercent)}
        title={messages.canvas.resetZoom(zoomPercent)}
        disabled={disabled}
        onClick={onResetZoom}
        className={[
          "grid h-[30px] min-w-[52px] place-items-center rounded-[7px] bg-transparent px-1.5 font-mono text-xs font-semibold text-[var(--text-2)] tabular-nums transition-colors hover:bg-[var(--fill)] disabled:cursor-default disabled:text-[var(--disabled)] disabled:hover:bg-transparent",
          focusRing,
        ].join(" ")}
      >
        {zoomPercent}%
      </button>
      <IconButton
        disabled={zoomInDisabled}
        label={messages.canvas.zoomIn}
        size={30}
        onClick={() => onZoom(zoomStep)}
      >
        <Plus className="size-[15px]" />
      </IconButton>
      <span
        aria-hidden="true"
        className="mx-0.5 h-[18px] w-px bg-[var(--line)]"
      />
      <IconButton
        disabled={disabled}
        label={messages.canvas.fitGraphTitle}
        size={30}
        onClick={onFitView}
      >
        <Maximize2 className="size-[15px]" />
      </IconButton>
    </div>
  );
}

type InteractionLayersProps = {
  mode: "select" | "node" | "edge";
  onAddNode: (event: CanvasPointer) => void;
};

export function InteractionLayers({ mode, onAddNode }: InteractionLayersProps) {
  const { messages } = useI18n();

  return (
    <>
      {mode === "node" ? (
        <div
          aria-label={messages.canvas.nodePlacementLayer}
          className="absolute inset-0 z-10 cursor-crosshair"
          onClick={onAddNode}
        />
      ) : null}
    </>
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
  onCompositionTextChange: (text: string) => void;
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
  onCompositionTextChange,
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
        onCompositionUpdate={(event) => {
          onCompositionTextChange(event.data);
        }}
        onCompositionEnd={() => {
          isComposingRef.current = false;
          onCompositionTextChange("");
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
          {edit.error}
        </div>
      ) : null}
    </form>
  );
}
