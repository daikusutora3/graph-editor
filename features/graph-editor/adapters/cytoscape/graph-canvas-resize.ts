import type { Core } from "cytoscape";

type CanvasRendererCore = {
  renderer: () => {
    canvasWidth?: number;
    canvasHeight?: number;
    flushRenderedStyleQueue?: () => void;
    render?: () => void;
  };
};

export function resizeCytoscapeCanvas(cy: Core) {
  if (cy.destroyed()) return;
  const renderer = (cy as unknown as CanvasRendererCore).renderer();
  const previousWidth = renderer.canvasWidth;
  const previousHeight = renderer.canvasHeight;
  cy.resize();

  if (
    renderer.canvasWidth !== previousWidth ||
    renderer.canvasHeight !== previousHeight
  ) {
    renderer.flushRenderedStyleQueue?.();
    renderer.render?.();
  }
}
