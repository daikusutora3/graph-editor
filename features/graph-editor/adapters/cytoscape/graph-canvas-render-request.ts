import type { Core } from "cytoscape";

type RenderRequestClock = {
  requestFrame: (callback: FrameRequestCallback) => number;
  cancelFrame: (id: number) => void;
};

/** Finish only the current request, after Cytoscape has painted its changes. */
export function afterCytoscapeRender(
  cy: Core,
  isCurrent: () => boolean,
  complete: () => void,
  clock: RenderRequestClock = {
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (id) => cancelAnimationFrame(id),
  },
) {
  let cancelled = false;
  let frame: number | null = null;
  const render = () => {
    if (cancelled || cy.destroyed() || !isCurrent()) return;
    frame = clock.requestFrame(() => {
      frame = null;
      if (!cancelled && !cy.destroyed() && isCurrent()) complete();
    });
  };
  cy.one("render", render);
  return () => {
    cancelled = true;
    cy.off("render", render);
    if (frame !== null) clock.cancelFrame(frame);
  };
}
