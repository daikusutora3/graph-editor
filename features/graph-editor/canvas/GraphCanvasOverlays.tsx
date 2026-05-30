"use client";

import { Maximize2, Minus, Plus } from "lucide-react";
import type { CSSProperties, MutableRefObject, RefObject } from "react";

import { useI18n } from "../i18n/I18nProvider";
import type { GraphCanvasChrome } from "./graph-canvas-types";
import type { NodeHitbox } from "../adapters/cytoscape/graph-canvas-hitboxes";
import type { InlineEditTarget, RenderedPoint } from "./graph-canvas-types";

type FitGraphButtonProps = {
  visible: boolean;
  chrome: GraphCanvasChrome;
  onFitView: () => void;
};

export function FitGraphButton({
  visible,
  chrome,
  onFitView,
}: FitGraphButtonProps) {
  const { messages } = useI18n();

  if (!visible) {
    return null;
  }

  return (
    <div
      className={[
        "pointer-events-none absolute top-[var(--app-space-5)] right-[calc(var(--app-space-3)+3.5rem+var(--app-space-5))] z-30 flex justify-center transition-[left,right] duration-[var(--app-duration-base)] ease-[var(--app-ease)] motion-reduce:transition-none",
        chrome.sidebarCollapsed
          ? "left-[calc(var(--app-space-3)+3.5rem+var(--app-space-5))]"
          : "left-[calc(var(--app-space-3)+var(--app-toolbar-width)+var(--app-space-5))]",
      ].join(" ")}
    >
      <button
        type="button"
        aria-label={messages.canvas.fitGraph}
        onClick={onFitView}
        className="pointer-events-auto inline-flex min-h-10 max-w-full items-center gap-2 rounded-[var(--app-radius-md)] border border-[var(--border)] bg-[var(--canvas-overlay-bg)] px-[var(--app-space-4)] py-2 text-[length:var(--app-text-sm)] leading-tight font-semibold text-[var(--text)] shadow-[var(--app-shadow-card)] backdrop-blur-md transition-colors hover:bg-[var(--state-hover-bg)] focus-visible:ring-2 focus-visible:ring-[var(--state-focus-ring)] focus-visible:outline-none"
      >
        <Maximize2 className="size-4" />
        <span>{messages.canvas.fitGraphTitle}</span>
      </button>
    </div>
  );
}

type ZoomControlsProps = {
  disabled: boolean;
  maxZoom: number;
  minZoom: number;
  zoomPercent: number;
  zoomStep: number;
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
  zoomPercent,
  zoomStep,
  onResetZoom,
  onZoom,
}: ZoomControlsProps) {
  const { messages } = useI18n();
  const minZoomPercent = Math.round(minZoom * 100);
  const maxZoomPercent = Math.round(maxZoom * 100);
  const zoomOutDisabled = zoomPercent <= minZoomPercent;
  const zoomInDisabled = zoomPercent >= maxZoomPercent;

  return (
    <div
      className="absolute right-[var(--app-space-5)] bottom-[var(--app-space-5)] z-40 flex h-9 items-center gap-[var(--app-space-2)]"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex h-9 items-center overflow-hidden rounded-[var(--app-radius-md)] border border-[var(--divider)] bg-[var(--canvas-overlay-bg)] backdrop-blur-md">
        <button
          type="button"
          aria-label={messages.canvas.zoomOut}
          aria-disabled={disabled || zoomOutDisabled}
          title={messages.canvas.zoomOut}
          disabled={disabled}
          onClick={() => {
            if (!zoomOutDisabled) {
              onZoom(-zoomStep);
            }
          }}
          className={[
            "gv-icon-button h-full w-8 rounded-none bg-transparent",
            zoomOutDisabled
              ? "cursor-not-allowed opacity-[var(--state-disabled-opacity)]"
              : "",
          ].join(" ")}
        >
          <Minus className="size-4" />
        </button>
        <button
          type="button"
          aria-label={messages.canvas.resetZoom(zoomPercent)}
          title={messages.canvas.resetZoom(zoomPercent)}
          disabled={disabled}
          onClick={onResetZoom}
          className="grid h-full min-w-12 place-items-center border-x border-[var(--divider)] bg-transparent px-[var(--app-space-2)] font-mono text-[length:var(--app-text-xs)] leading-none font-bold text-[var(--text-dim)] transition-colors hover:bg-[var(--state-hover-bg)] hover:text-[var(--state-hover-text)] focus-visible:ring-2 focus-visible:ring-[var(--state-focus-ring)] focus-visible:outline-none focus-visible:ring-inset disabled:opacity-[var(--state-disabled-opacity)]"
        >
          {zoomPercent}%
        </button>
        <button
          type="button"
          aria-label={messages.canvas.zoomIn}
          aria-disabled={disabled || zoomInDisabled}
          title={messages.canvas.zoomIn}
          disabled={disabled}
          onClick={() => {
            if (!zoomInDisabled) {
              onZoom(zoomStep);
            }
          }}
          className={[
            "gv-icon-button h-full w-8 rounded-none bg-transparent",
            zoomInDisabled
              ? "cursor-not-allowed opacity-[var(--state-disabled-opacity)]"
              : "",
          ].join(" ")}
        >
          <Plus className="size-4" />
        </button>
      </div>
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
        stroke={hasError ? "var(--err)" : "var(--accent-2-strong)"}
        strokeWidth="2.5"
        strokeDasharray="8 7"
        strokeLinecap="round"
      />
      {showTargetMarker ? (
        <circle
          cx={segment.target.x}
          cy={segment.target.y}
          r="5"
          fill={hasError ? "var(--err-soft)" : "var(--accent-2-soft)"}
          stroke={hasError ? "var(--err)" : "var(--accent-2-strong)"}
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
          className="gv-edit-feedback-node pointer-events-none absolute z-[18] size-16 rounded-full border-2"
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
        "gv-inline-edit-form pointer-events-auto absolute z-40 -translate-x-1/2 -translate-y-1/2",
        edit.kind === "node-label"
          ? "gv-inline-edit-form-node"
          : "gv-inline-edit-form-edge",
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
          "gv-inline-edit-input",
          edit.kind === "node-label"
            ? "gv-inline-edit-input-node"
            : "gv-inline-edit-input-edge",
          edit.error
            ? "gv-inline-edit-input-error"
            : "gv-inline-edit-input-valid",
        ].join(" ")}
      />
      {edit.error ? (
        <div
          role="alert"
          className="gv-inline-edit-error absolute top-full left-1/2 mt-1 max-w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 text-center"
        >
          {edit.error}
        </div>
      ) : null}
    </form>
  );
}
