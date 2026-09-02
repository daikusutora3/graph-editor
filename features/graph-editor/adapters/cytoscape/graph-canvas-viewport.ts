import type cytoscape from "cytoscape";
import type { Core, Position } from "cytoscape";

import type { GraphCanvasPalette } from "./cytoscape-adapter";
import type {
  GraphCanvasChrome,
  GraphCanvasExportOptions,
} from "../../canvas/graph-canvas-types";

export const MIN_CANVAS_ZOOM = 0.04;
export const MAX_CANVAS_ZOOM = 1.5;
export const ZOOM_STEP = 0.1;
const CANVAS_FIT_PADDING = 48;
const CHROME_INSETS = {
  desktop: { left: 16, right: 16, top: 76, bottom: 60 },
  compact: { left: 16, right: 16, top: 76, bottom: 60 },
  mobile: { left: 12, right: 12, top: 64, bottom: 88 },
} as const;
const VIEWPORT_RESCUE_TOLERANCE_PX = 8;
export const APP_ANIMATION_DURATION_MS = 180;
export const APP_ANIMATION_EASING =
  "cubic-bezier(0.2, 0, 0, 1)" as cytoscape.Css.TransitionTimingFunction;

type RenderedViewport = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export function readZoomPercent(cy: Core) {
  return Math.round(cy.zoom() * 100);
}

export function nextCanvasButtonZoomLevel(
  currentZoom: number,
  direction: number,
) {
  const stepPercent = ZOOM_STEP * 100;
  const currentPercent = Math.round(currentZoom * 100);
  const nextPercent =
    direction > 0
      ? Math.floor(currentPercent / stepPercent) * stepPercent + stepPercent
      : Math.ceil(currentPercent / stepPercent) * stepPercent - stepPercent;

  return clamp(nextPercent / 100, MIN_CANVAS_ZOOM, MAX_CANVAS_ZOOM);
}

export function readGraphOutOfView(cy: Core, chrome: GraphCanvasChrome) {
  const container = cy.container();

  if (!container || cy.nodes().length === 0) {
    return false;
  }

  const rect = container.getBoundingClientRect();
  const insets = graphViewportInsets(rect, chrome);
  const visibleBounds = {
    x1: insets.left,
    y1: insets.top,
    x2: rect.width - insets.right,
    y2: rect.height - insets.bottom,
  };
  return !cy
    .nodes()
    .toArray()
    .some((node) =>
      renderedPointInsideViewport(node.renderedPosition(), visibleBounds),
    );
}

export function renderedPointInsideViewport(
  point: Position,
  viewport: RenderedViewport,
  tolerance = VIEWPORT_RESCUE_TOLERANCE_PX,
) {
  return (
    point.x >= viewport.x1 - tolerance &&
    point.x <= viewport.x2 + tolerance &&
    point.y >= viewport.y1 - tolerance &&
    point.y <= viewport.y2 + tolerance
  );
}

export function clonePosition(position: Position): Position {
  return {
    x: position.x,
    y: position.y,
  };
}

export function syncCytoscapeSelection(
  cy: Core,
  selection: { nodeIds: string[]; edgeIds: string[] },
) {
  const selectedNodeIds = new Set(selection.nodeIds);
  const selectedEdgeIds = new Set(selection.edgeIds);

  cy.nodes(":selected").forEach((node) => {
    if (!selectedNodeIds.has(node.id())) {
      node.unselect();
    }
  });
  cy.edges(":selected").forEach((edge) => {
    if (!selectedEdgeIds.has(edge.id())) {
      edge.unselect();
    }
  });
  selection.nodeIds.forEach((nodeId) => cy.getElementById(nodeId).select());
  selection.edgeIds.forEach((edgeId) => cy.getElementById(edgeId).select());
}

export function fitGraphToAvailableViewport(
  cy: Core,
  chrome: GraphCanvasChrome,
) {
  const container = cy.container();

  if (!container) {
    return;
  }

  cy.resize();

  const elements = cy.elements();

  if (elements.length === 0) {
    centerGraphOrigin(cy, chrome);
    return;
  }

  const rect = container.getBoundingClientRect();

  if (!hasRenderableSize(rect)) {
    return;
  }

  const insets = graphViewportInsets(rect, chrome);
  const availableWidth = Math.max(
    1,
    rect.width - insets.left - insets.right - CANVAS_FIT_PADDING * 2,
  );
  const availableHeight = Math.max(
    1,
    rect.height - insets.top - insets.bottom - CANVAS_FIT_PADDING * 2,
  );
  const availableCenter = {
    x: insets.left + CANVAS_FIT_PADDING + availableWidth / 2,
    y: insets.top + CANVAS_FIT_PADDING + availableHeight / 2,
  };
  const bounds = elements.boundingBox({ includeLabels: true });
  const graphWidth = Math.max(bounds.w, 1);
  const graphHeight = Math.max(bounds.h, 1);
  const zoom = clamp(
    Math.min(availableWidth / graphWidth, availableHeight / graphHeight),
    MIN_CANVAS_ZOOM,
    MAX_CANVAS_ZOOM,
  );
  const graphCenter = {
    x: bounds.x1 + bounds.w / 2,
    y: bounds.y1 + bounds.h / 2,
  };

  applyViewport(cy, {
    pan: {
      x: availableCenter.x - graphCenter.x * zoom,
      y: availableCenter.y - graphCenter.y * zoom,
    },
    zoom,
  });
}

export function centerGraphOrigin(cy: Core, chrome: GraphCanvasChrome) {
  const container = cy.container();

  if (!container) {
    return;
  }

  const rect = container.getBoundingClientRect();

  if (!hasRenderableSize(rect)) {
    return;
  }

  const insets = graphViewportInsets(rect, chrome);
  const availableWidth = Math.max(1, rect.width - insets.left - insets.right);
  const availableHeight = Math.max(1, rect.height - insets.top - insets.bottom);

  applyViewport(cy, {
    pan: {
      x: insets.left + availableWidth / 2,
      y: insets.top + availableHeight / 2,
    },
    zoom: 1,
  });
}

function hasRenderableSize(rect: { width: number; height: number }) {
  return rect.width >= 2 && rect.height >= 2;
}

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function nextAnimationFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export function readExportBackground(
  background: GraphCanvasExportOptions["background"],
) {
  if (background === "transparent") {
    return undefined;
  }

  if (background === "white") {
    return "#ffffff";
  }

  if (background === "black") {
    return "#020617";
  }
}

export function exportImageErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return `画像の書き出しに失敗しました: ${error.message}`;
  }

  return "画像の書き出しに失敗しました";
}

export function readCanvasPalette(): GraphCanvasPalette {
  return {
    selectionBoxBorder: cssVar("--canvas-selection-border", "#8ecae6"),
    selectionBoxFill: cssVar("--canvas-selection-border", "#8ecae6"),
    node: cssVar("--canvas-node", "#ffffff"),
    nodeBorder: cssVar("--canvas-node-border", "#a1a1aa"),
    nodeText: cssVar("--canvas-node-text", "#171717"),
    nodeWhite: cssVar("--canvas-node-white", "#ffffff"),
    nodeBlack: cssVar("--canvas-node-black", "#111827"),
    nodeRed: cssVar("--canvas-node-red", "#fee2e2"),
    nodeYellow: cssVar("--canvas-node-yellow", "#fef3c7"),
    nodeBlue: cssVar("--canvas-node-blue", "#dbeafe"),
    nodeGreen: cssVar("--canvas-node-green", "#dcfce7"),
    nodePink: cssVar("--canvas-node-pink", "#ffe4e6"),
    edge: cssVar("--canvas-edge", "#6b7280"),
    edgeWhite: cssVar("--canvas-edge-white", "#ffffff"),
    edgeBlack: cssVar("--canvas-edge-black", "#111827"),
    edgeRed: cssVar("--canvas-edge-red", "#dc2626"),
    edgeYellow: cssVar("--canvas-edge-yellow", "#d97706"),
    edgeBlue: cssVar("--canvas-edge-blue", "#2563eb"),
    edgeGreen: cssVar("--canvas-edge-green", "#16a34a"),
    edgePink: cssVar("--canvas-edge-pink", "#e11d48"),
    labelBg: cssVar("--canvas-label-bg", "#ffffff"),
    labelBorder: cssVar("--canvas-label-border", "#d4d4d8"),
    active: cssVar("--canvas-active", "#2563eb"),
    selectedNode: cssVar("--canvas-selected-node", "#dbe6fd"),
    selectedNodeText: cssVar("--canvas-selected-node-text", "#1d4ed8"),
    activeOpacity: cssNumber("--canvas-active-opacity", 0.24),
    fontFamily: cssVar("--canvas-font", "system-ui, sans-serif"),
    nodeSize: cssPx("--canvas-node-size", 48),
    nodeFontSize: cssPx("--canvas-node-font", 14),
    edgeFontSize: cssPx("--canvas-edge-font", 12),
    labelPadding: cssPx("--canvas-label-padding", 4),
  };
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function applyViewport(
  cy: Core,
  {
    pan,
    zoom,
  }: {
    pan: Position;
    zoom: number;
  },
) {
  cy.stop(true, false);
  cy.zoom(zoom);
  cy.pan(pan);
}

function graphViewportInsets(
  rect: { width: number; height: number },
  chrome: GraphCanvasChrome,
) {
  const base = CHROME_INSETS[chrome.layout];
  const maxHorizontal = Math.max(0, rect.width - CANVAS_FIT_PADDING * 2);
  const maxVertical = Math.max(0, rect.height - CANVAS_FIT_PADDING * 2);
  const horizontal = base.left + base.right;
  const vertical = base.top + base.bottom;
  const horizontalScale =
    horizontal <= maxHorizontal || horizontal === 0
      ? 1
      : maxHorizontal / horizontal;
  const verticalScale =
    vertical <= maxVertical || vertical === 0 ? 1 : maxVertical / vertical;

  return {
    left: base.left * horizontalScale,
    right: base.right * horizontalScale,
    top: base.top * verticalScale,
    bottom: base.bottom * verticalScale,
  };
}

function cssVar(name: string, fallback: string) {
  if (typeof window === "undefined") {
    return fallback;
  }

  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback
  );
}

function cssPx(name: string, fallback: number) {
  const rawValue = cssVar(name, "");
  const value = Number.parseFloat(rawValue);

  if (!Number.isFinite(value)) {
    return fallback;
  }

  return rawValue.endsWith("rem")
    ? value *
        Number.parseFloat(
          getComputedStyle(document.documentElement).fontSize || "16",
        )
    : value;
}

function cssNumber(name: string, fallback: number) {
  const value = Number.parseFloat(cssVar(name, ""));

  return Number.isFinite(value) ? value : fallback;
}
