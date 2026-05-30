export type NodeId = string;
export type EdgeId = string;
export type GraphColor = "paper" | "yellow" | "blue" | "green" | "pink";
export type WeightKind = "none" | "number" | "string";

export type GraphNode = {
  id: NodeId;
  label: string;
  order: number;
  x: number;
  y: number;
  color?: GraphColor;
};

export type GraphEdge = {
  id: EdgeId;
  source: NodeId;
  target: NodeId;
  weight?: string;
  label?: string;
  color?: GraphColor;
  routing?: EdgeRoutingOverride;
};

export type EdgeRoutingOverride = {
  bowPx?: number;
  loopDirectionDeg?: number;
  loopSweepDeg?: number;
};

export type GraphSettings = {
  directed: boolean;
  weighted: boolean;
  indexBase: 0 | 1;
  allowSelfLoops: boolean;
  allowMultiEdges: boolean;
  autoEdgeRouting: boolean;
  weightKind: WeightKind;
};

export type GraphModel = {
  version: 1;
  nodes: GraphNode[];
  edges: GraphEdge[];
  settings: GraphSettings;
};

export type NodePositionMap = Record<NodeId, { x: number; y: number }>;

export type GraphPatch = {
  nodes?: {
    remove?: NodeId[];
    put?: GraphNode[];
    order?: NodeId[];
  };
  edges?: {
    remove?: EdgeId[];
    put?: GraphEdge[];
    order?: EdgeId[];
  };
  settings?: GraphSettings;
};

export type GraphTransaction = {
  label: string;
  forward: GraphPatch;
  backward: GraphPatch;
  beforeRevision: number;
  afterRevision: number;
};

export type GraphIntent =
  | { type: "replace-model"; label: string; model: GraphModel }
  | {
      type: "add-node";
      input: {
        id: NodeId;
        label?: string;
        x?: number;
        y?: number;
        color?: GraphColor;
      };
    }
  | {
      type: "add-edge";
      input: {
        id: EdgeId;
        source: NodeId;
        target: NodeId;
        weight?: string;
        label?: string;
        color?: GraphColor;
        routing?: EdgeRoutingOverride;
      };
    }
  | {
      type: "delete-selection";
      selection: { nodeIds: NodeId[]; edgeIds: EdgeId[] };
    }
  | {
      type: "update-node";
      nodeId: NodeId;
      patch: Partial<Pick<GraphNode, "label" | "x" | "y" | "order" | "color">>;
    }
  | { type: "set-nodes-color"; nodeIds: NodeId[]; color: GraphColor }
  | {
      type: "update-edge";
      edgeId: EdgeId;
      patch: Partial<
        Pick<
          GraphEdge,
          "source" | "target" | "label" | "weight" | "color" | "routing"
        >
      >;
    }
  | { type: "set-edges-color"; edgeIds: EdgeId[]; color: GraphColor }
  | { type: "reverse-edges"; edgeIds: EdgeId[] }
  | { type: "update-settings"; patch: Partial<GraphSettings> }
  | { type: "move-nodes"; label: string; after: NodePositionMap }
  | {
      type: "put-graph-elements";
      label: string;
      nodes: GraphNode[];
      edges: GraphEdge[];
    };
