import type { Core } from "cytoscape";

// Cytoscape 3.34.3 removal uses an ordinary object as its visited-ID set.
// Preserve arbitrary domain IDs without exposing Object.prototype keys to it.
// Escaping the prefix itself makes the mapping injective, including imported
// IDs that already look encoded. IDs elsewhere in the app remain unchanged.
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

/** Look up an editable model ID, encoding only at the Cytoscape boundary. */
export function getCytoscapeElement(cy: Core, id: string) {
  return cy.getElementById(encodeCytoscapeId(id));
}
