import type { Core, ElementDefinition, Position } from "cytoscape";

// Keep ordinary graphs unchanged. A distant cluster is rendered near zero so
// Canvas text textures do not receive very large absolute coordinates.
const LOCAL_COORDINATE_LIMIT = 1_000_000;
const ZERO_ORIGIN: Readonly<Position> = { x: 0, y: 0 };
const origins = new WeakMap<Core, Readonly<Position>>();

export function readCytoscapeCoordinateOrigin(cy: Core): Readonly<Position> {
  return origins.get(cy) ?? ZERO_ORIGIN;
}

export function toCytoscapePosition(cy: Core, position: Position): Position {
  const origin = readCytoscapeCoordinateOrigin(cy);
  return { x: position.x - origin.x, y: position.y - origin.y };
}

export function toGraphPosition(cy: Core, position: Position): Position {
  const origin = readCytoscapeCoordinateOrigin(cy);
  return { x: position.x + origin.x, y: position.y + origin.y };
}

/** Camera translation in the domain frame, independent of renderer rebasing. */
export function readGraphViewportPan(cy: Core): Position {
  const pan = cy.pan();
  const origin = readCytoscapeCoordinateOrigin(cy);
  const zoom = cy.zoom();
  return { x: pan.x - origin.x * zoom, y: pan.y - origin.y * zoom };
}

/** Definitions contain domain coordinates; Cytoscape owns local coordinates. */
export function projectCytoscapeElements(
  cy: Core,
  elements: ElementDefinition[],
  preserveOrigin = false,
) {
  const previous = readCytoscapeCoordinateOrigin(cy);
  const origin = preserveOrigin ? previous : chooseOrigin(elements, previous);
  const rebased = origin.x !== previous.x || origin.y !== previous.y;

  if (rebased) {
    const dx = origin.x - previous.x;
    const dy = origin.y - previous.y;
    // Rebase live positions too: dragging/selection and the current camera
    // keep their rendered location while the model is synchronized below.
    cy.nodes().forEach((node) => {
      const position = node.position();
      node.position({ x: position.x - dx, y: position.y - dy });
    });
    origins.set(cy, origin);
    const pan = cy.pan();
    const zoom = cy.zoom();
    cy.pan({ x: pan.x + dx * zoom, y: pan.y + dy * zoom });
  }

  return {
    rebased,
    elements:
      origin.x === 0 && origin.y === 0
        ? elements
        : elements.map((definition) =>
            definition.position
              ? {
                  ...definition,
                  position: {
                    x: definition.position.x - origin.x,
                    y: definition.position.y - origin.y,
                  },
                }
              : definition,
          ),
  };
}

function chooseOrigin(
  elements: ElementDefinition[],
  previous: Readonly<Position>,
): Readonly<Position> {
  let x1 = Infinity,
    y1 = Infinity,
    x2 = -Infinity,
    y2 = -Infinity;
  let local = true;
  for (const element of elements) {
    if (element.group !== "nodes" || !element.position) continue;
    const { x, y } = element.position;
    x1 = Math.min(x1, x);
    y1 = Math.min(y1, y);
    x2 = Math.max(x2, x);
    y2 = Math.max(y2, y);
    local &&=
      Math.abs(x - previous.x) <= LOCAL_COORDINATE_LIMIT &&
      Math.abs(y - previous.y) <= LOCAL_COORDINATE_LIMIT;
  }
  if (x1 === Infinity) return ZERO_ORIGIN;
  if (
    Math.max(Math.abs(x1), Math.abs(x2), Math.abs(y1), Math.abs(y2)) <=
    LOCAL_COORDINATE_LIMIT
  )
    return ZERO_ORIGIN;
  // A stable origin avoids moving every element during ordinary nearby edits.
  if (local) return previous;
  return { x: x1 + (x2 - x1) / 2, y: y1 + (y2 - y1) / 2 };
}
