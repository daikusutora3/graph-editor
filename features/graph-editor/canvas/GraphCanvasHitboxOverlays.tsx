"use client";

import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

import { memo, useLayoutEffect, useMemo, useRef } from "react";

import { cn } from "@/lib/utils";

import type { EdgeId, NodeId } from "../core/graph/model";
import { pillExtentTowards } from "../core/graph/node-size";
import { useI18n } from "../i18n/I18nProvider";
import { focusRing } from "../ui/primitives/styles";
import type { Messages } from "../i18n/messages";

import {
  edgeLabelHitboxWidth,
  NODE_HITBOX_SIZE,
  type EdgeLabelHitbox,
  type NodeHitbox,
} from "../adapters/cytoscape/graph-canvas-hitboxes";
import {
  clampBow,
  curveFromControlPoint,
  edgeCurveMidpoint,
  edgeCurveSvgPath,
  quadraticControlThroughPoint,
} from "../core/layout/edge-route-geometry";
import type { RenderedPoint } from "./graph-canvas-types";

type CanvasPointer = {
  clientX: number;
  clientY: number;
};

type EdgeNodeHitboxesProps = {
  nodes: NodeHitbox[];
  sourceNodeId: NodeId | null;
  onConnect: (nodeId: NodeId, continueFromTarget: boolean) => void;
  onContextMenu: (node: NodeHitbox, event: CanvasPointer) => void;
  onPointerEnter: (node: NodeHitbox) => void;
  onPointerLeave: (nodeId: NodeId) => void;
};

export const EdgeNodeHitboxes = memo(function EdgeNodeHitboxes({
  nodes,
  sourceNodeId,
  onConnect,
  onContextMenu,
  onPointerEnter,
  onPointerLeave,
}: EdgeNodeHitboxesProps) {
  const { messages } = useI18n();

  return (
    <>
      {nodes.map((node) => {
        const isSource = sourceNodeId === node.id;
        const nodeName = accessibleNodeName(node.label, messages);

        return (
          <button
            key={node.id}
            type="button"
            data-edge-node-hitbox="true"
            data-graph-shortcut-target="true"
            aria-label={
              isSource
                ? messages.canvas.sourceSelected(nodeName)
                : messages.canvas.connectEdgeTo(nodeName)
            }
            className={cn(
              "group pointer-events-auto absolute z-20 size-14 -translate-x-1/2 -translate-y-1/2 cursor-crosshair rounded-full",
              focusRing,
            )}
            style={{ left: node.x, top: node.y }}
            onPointerEnter={() => onPointerEnter(node)}
            onPointerLeave={() => onPointerLeave(node.id)}
            onClick={(event) => {
              event.stopPropagation();
              onConnect(node.id, event.shiftKey);
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onContextMenu(node, event);
            }}
          >
            {isSource ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-[-1px] rounded-full border-[1.5px] border-dashed border-[var(--accent)]"
              />
            ) : (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-[-1px] rounded-full border-[1.5px] border-[var(--accent)] opacity-0 transition-opacity duration-150 group-hover:opacity-60"
              />
            )}
          </button>
        );
      })}
    </>
  );
});

type SelectEdgeHitboxesProps = {
  selectedEdgeIds: ReadonlySet<EdgeId>;
  edges: EdgeLabelHitbox[];
  rangeSelectionActive: boolean;
  weighted: boolean;
  onContextMenu: (edge: EdgeLabelHitbox, event: CanvasPointer) => void;
  /** Drag-to-bend: preview while dragging, commit on release, cancel on
   * escape/pointer cancel. `zoom` converts rendered px to graph px. */
  zoom: number;
  onBendPreview: (edgeId: EdgeId, bend: EdgeBend) => RenderedPoint | null;
  onBendCommit: (edgeId: EdgeId, bend: EdgeBend) => void;
  onBendCancel: (edgeId: EdgeId) => void;
  onEdit: (edgeId: EdgeId, position: RenderedPoint) => void;
  onRangeSelectionPointerDown: (event: ReactPointerEvent<Element>) => boolean;
  onSelect: (edgeId: EdgeId, additive: boolean) => void;
};

export function SelectEdgeHitboxes(props: SelectEdgeHitboxesProps) {
  const propsRef = useRef(props);
  useLayoutEffect(() => {
    propsRef.current = props;
  });
  const bendRef = useRef<{
    captureElement: Element;
    edge: EdgeLabelHitbox;
    pointerId: number;
    startX: number;
    startY: number;
    moved: boolean;
    bend: EdgeBend | null;
  } | null>(null);
  const suppressClickRef = useRef(false);

  // Activity retains the DOM while hidden, so cancel transient bends at the
  // same boundary that previously unmounted their pointer capture elements.
  useLayoutEffect(
    () => () => {
      const bend = bendRef.current;
      bendRef.current = null;
      suppressClickRef.current = false;
      if (!bend) return;
      try {
        bend.captureElement.releasePointerCapture(bend.pointerId);
      } catch {
        // The browser may already have released the pointer.
      }
      if (bend.moved) propsRef.current.onBendCancel(bend.edge.id);
    },
    [],
  );

  // Dispatch through committed props so fresh parent callbacks do not force
  // thousands of hitboxes to render, and skipped renders never use stale ones.
  const handlers = useMemo<EdgeHitboxHandlers>(
    () => ({
      onPointerDown: (edge, event) => {
        if (
          event.button !== 0 ||
          event.shiftKey ||
          event.metaKey ||
          event.ctrlKey ||
          propsRef.current.rangeSelectionActive
        ) {
          return;
        }

        bendRef.current = {
          captureElement: event.currentTarget,
          edge,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          moved: false,
          bend: null,
        };
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Synthetic or already-released pointers cannot be captured; the
          // drag still works while the pointer stays over the element.
        }
      },
      onPointerMove: (edge, event) => {
        const bend = bendRef.current;

        if (!bend || bend.pointerId !== event.pointerId) {
          return;
        }

        if (
          !bend.moved &&
          Math.hypot(event.clientX - bend.startX, event.clientY - bend.startY) <
            4
        ) {
          return;
        }

        if (!bend.moved) {
          bend.moved = true;
          propsRef.current.onSelect(edge.id, false);
        }

        const bounds = (
          event.currentTarget.closest("svg") ?? event.currentTarget
        ).parentElement?.getBoundingClientRect();
        bend.bend = edgeBendFromRenderedPointer(
          edge,
          {
            x: event.clientX - (bounds?.left ?? 0),
            y: event.clientY - (bounds?.top ?? 0),
          },
          propsRef.current.zoom,
        );
        propsRef.current.onBendPreview(edge.id, bend.bend);
      },
      onPointerUp: (edge, event) => {
        const bend = bendRef.current;

        if (!bend || bend.pointerId !== event.pointerId) {
          return;
        }

        bendRef.current = null;
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
          // Capture may already be gone.
        }

        if (bend.moved && bend.bend !== null) {
          suppressClickRef.current = true;
          propsRef.current.onBendCommit(edge.id, bend.bend);
        }
      },
      onPointerCancel: (edge, event) => {
        const bend = bendRef.current;

        if (!bend || bend.pointerId !== event.pointerId) {
          return;
        }

        bendRef.current = null;

        if (bend.moved) {
          suppressClickRef.current = true;
          propsRef.current.onBendCancel(edge.id);
        }
      },
      onPointerDownCapture: (_edge, event) => {
        propsRef.current.onRangeSelectionPointerDown(event);
      },
      onClick: (edge, event) => {
        event.stopPropagation();
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          return;
        }
        if (event.detail >= 2) {
          propsRef.current.onEdit(edge.id, { x: edge.x, y: edge.y });
          return;
        }
        propsRef.current.onSelect(edge.id, event.shiftKey);
      },
      onDoubleClick: (edge, event) => {
        event.preventDefault();
        event.stopPropagation();
        propsRef.current.onEdit(edge.id, { x: edge.x, y: edge.y });
      },
      onContextMenu: (edge, event) => {
        event.preventDefault();
        event.stopPropagation();
        propsRef.current.onContextMenu(edge, event);
      },
    }),
    [],
  );

  // Disable the complete interaction layer at its boundary. Modifier changes
  // then retain the memoized buttons and SVG paths instead of rerendering them.
  return (
    <div
      className="pointer-events-none absolute inset-0"
      inert={props.rangeSelectionActive}
    >
      <SelectEdgeHitboxList
        edges={props.edges}
        selectedEdgeIds={props.selectedEdgeIds}
        weighted={props.weighted}
        handlers={handlers}
      />
    </div>
  );
}

type EdgeHitboxHandlers = {
  onPointerDown: (
    edge: EdgeLabelHitbox,
    event: ReactPointerEvent<Element>,
  ) => void;
  onPointerMove: (
    edge: EdgeLabelHitbox,
    event: ReactPointerEvent<Element>,
  ) => void;
  onPointerUp: (
    edge: EdgeLabelHitbox,
    event: ReactPointerEvent<Element>,
  ) => void;
  onPointerCancel: (
    edge: EdgeLabelHitbox,
    event: ReactPointerEvent<Element>,
  ) => void;
  onPointerDownCapture: (
    edge: EdgeLabelHitbox,
    event: ReactPointerEvent<Element>,
  ) => void;
  onClick: (edge: EdgeLabelHitbox, event: ReactMouseEvent<Element>) => void;
  onDoubleClick: (
    edge: EdgeLabelHitbox,
    event: ReactMouseEvent<Element>,
  ) => void;
  onContextMenu: (
    edge: EdgeLabelHitbox,
    event: ReactMouseEvent<Element>,
  ) => void;
};

const SelectEdgeHitboxList = memo(function SelectEdgeHitboxList({
  edges,
  selectedEdgeIds,
  weighted,
  handlers,
}: Pick<SelectEdgeHitboxesProps, "edges" | "selectedEdgeIds" | "weighted"> & {
  handlers: EdgeHitboxHandlers;
}) {
  return (
    <>
      <SelectEdgePaths edges={edges} handlers={handlers} />
      {edges.map((edge) => (
        <SelectEdgeLabelButton
          key={edge.id}
          edge={edge}
          selected={selectedEdgeIds.has(edge.id)}
          weighted={weighted}
          handlers={handlers}
        />
      ))}
    </>
  );
});

// Paths do not depend on selection. Keep their list stable when a label or
// node is selected so React does not traverse thousands of unchanged paths.
const SelectEdgePaths = memo(function SelectEdgePaths({
  edges,
  handlers,
}: Pick<SelectEdgeHitboxesProps, "edges"> & {
  handlers: EdgeHitboxHandlers;
}) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[18] h-full w-full overflow-visible"
      aria-hidden="true"
    >
      {edges.map((edge) => (
        <SelectEdgePath key={edge.id} edge={edge} handlers={handlers} />
      ))}
    </svg>
  );
});

type EdgeHitboxProps = {
  edge: EdgeLabelHitbox;
  handlers: EdgeHitboxHandlers;
};

function edgeHitboxEventProps(
  edge: EdgeLabelHitbox,
  handlers: EdgeHitboxHandlers,
) {
  return {
    onPointerDown: (event: ReactPointerEvent<Element>) =>
      handlers.onPointerDown(edge, event),
    onPointerMove: (event: ReactPointerEvent<Element>) =>
      handlers.onPointerMove(edge, event),
    onPointerUp: (event: ReactPointerEvent<Element>) =>
      handlers.onPointerUp(edge, event),
    onPointerCancel: (event: ReactPointerEvent<Element>) =>
      handlers.onPointerCancel(edge, event),
    onPointerDownCapture: (event: ReactPointerEvent<Element>) =>
      handlers.onPointerDownCapture(edge, event),
    onClick: (event: ReactMouseEvent<Element>) => handlers.onClick(edge, event),
    onDoubleClick: (event: ReactMouseEvent<Element>) =>
      handlers.onDoubleClick(edge, event),
    onContextMenu: (event: ReactMouseEvent<Element>) =>
      handlers.onContextMenu(edge, event),
  };
}

const SelectEdgePath = memo(function SelectEdgePath({
  edge,
  handlers,
}: EdgeHitboxProps) {
  return (
    <path
      d={createEdgeHitboxPath(edge)}
      fill="none"
      pointerEvents="stroke"
      className="cursor-pointer touch-none stroke-transparent"
      strokeWidth="18"
      strokeLinecap="round"
      {...edgeHitboxEventProps(edge, handlers)}
    />
  );
});

const SelectEdgeLabelButton = memo(function SelectEdgeLabelButton({
  edge,
  selected,
  weighted,
  handlers,
}: EdgeHitboxProps & { selected: boolean; weighted: boolean }) {
  const { messages } = useI18n();
  return (
    <button
      type="button"
      data-graph-shortcut-target="true"
      aria-label={
        weighted
          ? messages.canvas.editEdgeWeightOf(edge.label)
          : edge.label
            ? messages.canvas.editEdgeLabelOf(edge.label)
            : messages.canvas.editEdgeLabel
      }
      aria-pressed={selected}
      className="ge-select-edge-hitbox"
      style={{
        left: 0,
        top: 0,
        translate: `${edge.x}px ${edge.y}px`,
        width: edgeLabelHitboxWidth(edge.label),
      }}
      {...edgeHitboxEventProps(edge, handlers)}
    />
  );
});

export type EdgeBend = {
  /** Perpendicular control-point offset in graph px (sign = side). */
  bowPx: number;
  /** Control-point position along the edge, 0 = source, 1 = target. */
  bowT: number;
};

type Point = { x: number; y: number };

type BendEndpoints = Pick<
  EdgeLabelHitbox,
  "sourceX" | "sourceY" | "targetX" | "targetY"
> &
  Partial<Pick<EdgeLabelHitbox, "sourceWidth" | "targetWidth" | "nodeHeight">>;

/** Moves `from` to its pill boundary in the direction of `to`. */
function boundaryTowards(
  from: Point,
  to: Point,
  widthPx: number,
  heightPx: number,
): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const reach = pillExtentTowards(widthPx / 2, heightPx / 2, dx, dy);

  return {
    x: from.x + (dx / length) * reach,
    y: from.y + (dy / length) * reach,
  };
}

/**
 * Converts a pointer position into a manual bend so the drawn curve passes
 * through the pointer. Cytoscape starts the curve where the line from the
 * control point meets each node's border, so the control point is refined a
 * few times against those border points before being expressed relative to
 * the centre-to-centre chord (which is what the routing data stores).
 */
export function edgeBendFromRenderedPointer(
  edge: BendEndpoints,
  pointer: RenderedPoint,
  zoom: number,
): EdgeBend {
  const source = { x: edge.sourceX, y: edge.sourceY };
  const target = { x: edge.targetX, y: edge.targetY };

  if (Math.hypot(target.x - source.x, target.y - source.y) === 0 || zoom <= 0) {
    return { bowPx: 0, bowT: 0.5 };
  }

  let control = quadraticControlThroughPoint(source, target, pointer);
  const height = edge.nodeHeight ?? 0;

  if (height > 0) {
    // Include the border so the refined endpoints sit on the drawn outline.
    const border = 2 * zoom;

    for (let step = 0; step < 4; step += 1) {
      control = quadraticControlThroughPoint(
        boundaryTowards(
          source,
          control,
          (edge.sourceWidth ?? height) + border,
          height + border,
        ),
        boundaryTowards(
          target,
          control,
          (edge.targetWidth ?? height) + border,
          height + border,
        ),
        pointer,
      );
    }
  }

  // Distances are stored in graph px; weights are zoom-independent.
  const curve = curveFromControlPoint(source, target, control, {
    limitBow: false,
  });

  return {
    bowPx:
      Math.round(clampBow(curve.controlPointDistancesPx[0] / zoom) * 10) / 10,
    bowT: Math.round(curve.controlPointWeights[0] * 1000) / 1000,
  };
}

export function edgeBendHandlePosition(
  edge: EdgeLabelHitbox,
  preview: EdgeBend | null,
  zoom: number,
) {
  if (preview == null) {
    return { x: edge.x, y: edge.y };
  }

  return edgeCurveMidpoint(
    { x: edge.sourceX, y: edge.sourceY },
    { x: edge.targetX, y: edge.targetY },
    {
      controlPointDistancesPx: [preview.bowPx * zoom],
      controlPointWeights: [preview.bowT],
    },
  );
}

export function createEdgeHitboxPath(edge: EdgeLabelHitbox) {
  if (edge.sourceX === edge.targetX && edge.sourceY === edge.targetY) {
    return createLoopHitboxPath(edge);
  }

  return edgeCurveSvgPath(
    { x: edge.sourceX, y: edge.sourceY },
    { x: edge.targetX, y: edge.targetY },
    {
      controlPointDistancesPx: edge.controlPointDistancesPx ?? [edge.bowPx],
      controlPointWeights: edge.controlPointWeights ?? [0.5],
    },
  );
}

function createLoopHitboxPath(edge: EdgeLabelHitbox) {
  const direction = ((edge.loopDirectionDeg - 90) * Math.PI) / 180;
  const sweep = (edge.loopSweepDeg * Math.PI) / 180;
  const nodeRadius = 24;
  const loopRadius = 72;
  const startAngle = direction - sweep / 2;
  const endAngle = direction + sweep / 2;
  const start = {
    x: edge.sourceX + Math.cos(startAngle) * nodeRadius,
    y: edge.sourceY + Math.sin(startAngle) * nodeRadius,
  };
  const end = {
    x: edge.sourceX + Math.cos(endAngle) * nodeRadius,
    y: edge.sourceY + Math.sin(endAngle) * nodeRadius,
  };
  const controlA = {
    x: edge.sourceX + Math.cos(startAngle) * loopRadius,
    y: edge.sourceY + Math.sin(startAngle) * loopRadius,
  };
  const controlB = {
    x: edge.sourceX + Math.cos(endAngle) * loopRadius,
    y: edge.sourceY + Math.sin(endAngle) * loopRadius,
  };

  return [
    `M${round(start.x)} ${round(start.y)}`,
    `C${round(controlA.x)} ${round(controlA.y)}`,
    `${round(controlB.x)} ${round(controlB.y)}`,
    `${round(end.x)} ${round(end.y)}`,
  ].join(" ");
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

type SelectNodeHitboxesProps = {
  selectedNodeIds: ReadonlySet<NodeId>;
  nodes: NodeHitbox[];
  rangeSelectionActive: boolean;
  onClick: (
    node: NodeHitbox,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => void;
  onContextMenu: (node: NodeHitbox, event: CanvasPointer) => void;
  onDoubleClick: (
    node: NodeHitbox,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerDown: (
    nodeId: NodeId,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onRangeSelectionPointerDown: (event: ReactPointerEvent<Element>) => boolean;
  onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void;
};

type NodeHitboxHandlers = Omit<
  SelectNodeHitboxesProps,
  "nodes" | "selectedNodeIds" | "rangeSelectionActive"
>;

export function SelectNodeHitboxes(props: SelectNodeHitboxesProps) {
  const propsRef = useRef(props);
  useLayoutEffect(() => {
    propsRef.current = props;
  });
  const handlers = useMemo<NodeHitboxHandlers>(
    () => ({
      onClick: (node, event) => propsRef.current.onClick(node, event),
      onContextMenu: (node, event) =>
        propsRef.current.onContextMenu(node, event),
      onDoubleClick: (node, event) =>
        propsRef.current.onDoubleClick(node, event),
      onPointerCancel: (event) => propsRef.current.onPointerCancel(event),
      onPointerDown: (nodeId, event) =>
        propsRef.current.onPointerDown(nodeId, event),
      onPointerMove: (event) => propsRef.current.onPointerMove(event),
      onPointerUp: (event) => propsRef.current.onPointerUp(event),
      onRangeSelectionPointerDown: (event) =>
        propsRef.current.onRangeSelectionPointerDown(event),
    }),
    [],
  );
  // The wrapper matches the canvas frame, including the pointer coordinates
  // used by the edge layer, and inert excludes every descendant from focus.
  return (
    <div
      className="pointer-events-none absolute inset-0"
      inert={props.rangeSelectionActive}
    >
      <SelectNodeHitboxList
        nodes={props.nodes}
        selectedNodeIds={props.selectedNodeIds}
        handlers={handlers}
      />
    </div>
  );
}

const SelectNodeHitboxList = memo(function SelectNodeHitboxList({
  nodes,
  selectedNodeIds,
  handlers,
}: Pick<SelectNodeHitboxesProps, "nodes" | "selectedNodeIds"> & {
  handlers: NodeHitboxHandlers;
}) {
  return (
    <>
      {nodes.map((node) => (
        <SelectNodeButton
          key={node.id}
          node={node}
          selected={selectedNodeIds.has(node.id)}
          handlers={handlers}
        />
      ))}
    </>
  );
});

const SelectNodeButton = memo(function SelectNodeButton({
  node,
  selected,
  handlers,
}: {
  node: NodeHitbox;
  selected: boolean;
  handlers: NodeHitboxHandlers;
}) {
  const { messages } = useI18n();

  return (
    <button
      type="button"
      data-graph-shortcut-target="true"
      aria-label={messages.canvas.selectNode(
        accessibleNodeName(node.label, messages),
      )}
      aria-pressed={selected}
      className="ge-select-node-hitbox"
      style={{
        height: NODE_HITBOX_SIZE,
        left: 0,
        top: 0,
        translate: `${node.x}px ${node.y}px`,
        width: node.width,
      }}
      onPointerDown={(event) => {
        if (handlers.onRangeSelectionPointerDown(event)) {
          return;
        }

        event.stopPropagation();
        handlers.onPointerDown(node.id, event);
      }}
      onPointerMove={handlers.onPointerMove}
      onPointerUp={handlers.onPointerUp}
      onPointerCancel={handlers.onPointerCancel}
      onClick={(event) => {
        event.stopPropagation();
        handlers.onClick(node, event);
      }}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        handlers.onDoubleClick(node, event);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        handlers.onContextMenu(node, event);
      }}
    />
  );
});

function accessibleNodeName(label: string, messages: Messages) {
  return label
    ? messages.canvas.nodeName(label)
    : messages.canvas.unlabeledNode;
}
