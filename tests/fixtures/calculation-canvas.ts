import cytoscape, { type Core, type Css, type EventHandler } from "cytoscape";
import { graphModelToCytoscapeElements } from "../../features/graph-editor/adapters/cytoscape/cytoscape-adapter";
import {
  defaultEdgeRoutingMeta,
  type EdgeRoutingMeta,
} from "../../features/graph-editor/core/layout/edge-routing";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";

type CalculationRenderer = {
  registerNodeShapes: () => void;
  registerArrowShapes: () => void;
  registerCalculationListeners: () => void;
  flushRenderedStyleQueue: () => void;
};
type GeometryCollection = {
  cleanStyle: () => void;
  dirtyBoundingBoxCache: () => void;
};

/** Real Cytoscape projections and bbox cache; only font measurement is stubbed.
 * No DOM or canvas raster is involved. Native screenshots cover that separately.
 */
export function createCalculationCanvas(
  graph: GraphModel,
  edgeRoutingMeta?: ReadonlyMap<string, EdgeRoutingMeta>,
) {
  const cy = cytoscape({
    headless: true,
    styleEnabled: true,
    // Headless has a 1px viewport; automatic fit would collapse zoom to 1e-50
    // and make node movement invisible in rendered geometry assertions.
    layout: { name: "preset", fit: false },
    elements: definitions(graph, edgeRoutingMeta),
    style: [
      { selector: "node", style: { width: 48, height: 48, shape: "ellipse" } },
      {
        selector: "edge",
        style: {
          "curve-style": "unbundled-bezier",
          "control-point-distances": "data(controlPointDistances)",
          "control-point-weights": "data(controlPointWeights)",
          "loop-direction": "data(loopDirection)",
          "loop-sweep": "data(loopSweep)",
          label: "data(label)",
          "font-size": 12,
          "text-background-padding": "5px",
          "text-rotation": "none",
        },
      },
      {
        selector: "edge:loop",
        style: {
          "control-point-step-size": "data(loopStepSize)",
        } as unknown as Css.Edge,
      },
    ],
  });
  // Use the installed renderer's exact projection/cache implementation.
  const Base = cytoscape("renderer", "base") as {
    prototype: CalculationRenderer;
  };
  const renderer = Object.assign(Object.create(Base.prototype), {
    cy,
    destroyed: false,
    bezierProjPcts: [0.05, 0.225, 0.4, 0.5, 0.6, 0.775, 0.95],
    beforeRenderCallbacks: [],
    beforeRenderPriorities: { eleCalcs: 300 },
    notify() {},
    isHeadless: () => false,
    calculateLabelDimensions: (_element: unknown, text: string) => ({
      width: text.length * 7,
      height: 12,
      labelActualDescent: 3,
    }),
    binder: (target: Core) => {
      const chain = {
        on: (events: string, handler: EventHandler) => {
          target.on(events, handler);
          return chain;
        },
      };
      return chain;
    },
  }) as CalculationRenderer;
  renderer.registerNodeShapes();
  renderer.registerArrowShapes();
  const internals = cy as unknown as {
    _private: { renderer: CalculationRenderer };
  };
  // Test-only replacement runs the installed projections without a DOM canvas.
  // eslint-disable-next-line no-underscore-dangle
  internals._private.renderer = renderer;
  renderer.registerCalculationListeners();
  const geometry = cy.elements() as unknown as GeometryCollection;
  geometry.cleanStyle();
  geometry.dirtyBoundingBoxCache();
  renderer.flushRenderedStyleQueue();
  cy.elements().boundingBox();
  renderer.flushRenderedStyleQueue();
  return { cy, renderer };
}

function definitions(
  graph: GraphModel,
  edgeRoutingMeta?: ReadonlyMap<string, EdgeRoutingMeta>,
) {
  return graphModelToCytoscapeElements(graph, {
    edgeRoutingMeta:
      edgeRoutingMeta ??
      new Map(graph.edges.map((edge) => [edge.id, defaultEdgeRoutingMeta])),
  });
}
