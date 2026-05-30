import type { GraphModel } from "../core/graph/model";
import type { GraphPerformanceEvent } from "./graph-performance-events";

export type GraphBenchmarkSize = {
  nodes: number;
  edges: number;
};

export type GraphPerformanceMetric = {
  actionMs: number;
  durationMs: number;
  events: GraphPerformanceEvent[];
  family: string;
  graph: GraphBenchmarkSize;
  name: string;
  ok: boolean;
  result?: Record<string, number | string | boolean | null>;
  run: number;
  settleMs: number;
  warmup: boolean;
};

export type GraphPerformanceSuite = {
  metrics: GraphPerformanceMetric[];
  summaries: GraphPerformanceSummary[];
  summary: {
    totalMs: number;
    nodes: number;
    edges: number;
    userAgent: string;
  };
};

export type GraphPerformanceSummary = {
  actionP50Ms: number;
  actionP90Ms: number;
  durationP50Ms: number;
  durationP90Ms: number;
  events: Record<string, { p50Ms: number; p90Ms: number }>;
  family: string;
  name: string;
  runs: number;
  settleP50Ms: number;
  settleP90Ms: number;
};

export type GraphPerformanceRunOptions = {
  runs?: number;
  warmups?: number;
};

export type BenchmarkCase = {
  action: () =>
    | void
    | Record<string, number | string | boolean | null>
    | Promise<Record<string, number | string | boolean | null> | void>;
  family: string;
  graph: GraphModel;
  name: string;
};

export type { GraphPerformanceEvent } from "./graph-performance-events";
