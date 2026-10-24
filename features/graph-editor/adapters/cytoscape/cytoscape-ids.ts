import type { Core } from "cytoscape";

export const CYTOSCAPE_ID_ESCAPE_PREFIX = "__ge_id__:";

export function encodeCytoscapeId(id: string) {
  return Object.hasOwn(Object.prototype, id) ||
    id.startsWith(CYTOSCAPE_ID_ESCAPE_PREFIX)
    ? CYTOSCAPE_ID_ESCAPE_PREFIX + id
    : id;
}

export function decodeCytoscapeId(id: string) {
  return id.startsWith(CYTOSCAPE_ID_ESCAPE_PREFIX)
    ? id.slice(CYTOSCAPE_ID_ESCAPE_PREFIX.length)
    : id;
}

export function getCytoscapeElement(cy: Core, id: string) {
  return cy.getElementById(encodeCytoscapeId(id));
}
