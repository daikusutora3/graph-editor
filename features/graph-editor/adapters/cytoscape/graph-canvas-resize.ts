import type { Core } from "cytoscape";

// Cytoscape 3.34.3 exposes its renderer but omits it from the declarations.
// Keep the canvas-renderer compatibility boundary inside this adapter.
type CanvasRendererCore = {
  renderer: () => {
    canvasWidth?: number;
    canvasHeight?: number;
    flushRenderedStyleQueue?: () => void;
    render?: () => void;
  };
};

/** A resize clears canvas pixels; repaint before the observer's frame is shown. */
export function resizeCytoscapeCanvas(cy: Core) {
  if (cy.destroyed()) return;
  const renderer = (cy as unknown as CanvasRendererCore).renderer();
  const previousWidth = renderer.canvasWidth;
  const previousHeight = renderer.canvasHeight;
  cy.resize();
  // ResizeObserver can run after the renderer's RAF. forceRender only queues
  // another RAF, leaving a blank frame after canvas.width/height reset pixels.
  // Same-size notifications retain pixels and need no additional paint.
  if (
    renderer.canvasWidth !== previousWidth ||
    renderer.canvasHeight !== previousHeight
  ) {
    // Element/style edits may share this frame with the resize. The usual RAF
    // prepares geometry and invalidates cached textures before render too.
    renderer.flushRenderedStyleQueue?.();
    renderer.render?.();
  }
}
