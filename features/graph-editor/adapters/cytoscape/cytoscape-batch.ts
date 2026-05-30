import type { Core } from "cytoscape";

export function withCytoscapeBatch<T>(cy: Core, callback: () => T): T {
  cy.startBatch();

  try {
    return callback();
  } finally {
    cy.endBatch();
  }
}
