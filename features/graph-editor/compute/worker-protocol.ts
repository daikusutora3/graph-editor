import type {
  GraphIntent,
  GraphModel,
  GraphNode,
  NodeId,
} from "../core/graph/model";
import type {
  EdgeRoutingMeta,
  EdgeRoutingOptions,
} from "../core/layout/edge-routing";
import type { LayoutKind } from "../layouts/manual-layouts";
import type { OverlapResult } from "../layouts/resolve-node-overlaps";
import type { RustKernelCalls } from "./rust-kernel";
import type { RoutingDelta } from "./routing-result";

export type ComputeJob =
  | {
      kind: "layout";
      model: GraphModel;
      layout: LayoutKind;
      rootNodeId?: NodeId;
    }
  | { kind: "overlap"; model: GraphModel }
  | {
      kind: "routing";
      model: GraphModel;
      options: EdgeRoutingOptions;
      interaction?: RoutingInteraction;
    };
export type RoutingInteraction = {
  movedNodeIds: ReadonlySet<NodeId>;
} & (
  | { previousNodes: GraphNode[] }
  // Existing callers may supply the full selection snapshot directly.
  | { nodes: GraphNode[] }
);
export type ComputeValue =
  GraphIntent | OverlapResult | Map<string, EdgeRoutingMeta>;
export type ComputeRequest =
  { id: number; job: ComputeJob } | { cancel: number };
export type ComputeResponse =
  | { id: number; result: ComputeValue; kernels: RustKernelCalls }
  | { id: number; routingDelta: RoutingDelta; kernels: RustKernelCalls }
  | { id: number; error: string; failure: "transient" | "permanent" };
