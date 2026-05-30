import type {
  GraphBenchmarkSize,
  GraphPerformanceMetric,
  GraphPerformanceSummary,
} from "./graph-performance-types";
import { roundMs } from "./graph-performance-events";
import type { GraphModel } from "../core/graph/model";

export function graphSize(model: GraphModel): GraphBenchmarkSize {
  return {
    edges: model.edges.length,
    nodes: model.nodes.length,
  };
}

export function summarizeMetrics(
  metrics: GraphPerformanceMetric[],
): GraphPerformanceSummary[] {
  const groups = new Map<string, GraphPerformanceMetric[]>();

  for (const metric of metrics) {
    if (metric.warmup || !metric.ok) {
      continue;
    }

    const key = `${metric.family}:${metric.name}`;
    groups.set(key, [...(groups.get(key) ?? []), metric]);
  }

  return Array.from(groups.values(), (samples) => {
    const first = samples[0];
    const eventDurations = new Map<string, number[]>();

    for (const sample of samples) {
      const totals = new Map<string, number>();

      for (const event of sample.events) {
        totals.set(
          event.kind,
          (totals.get(event.kind) ?? 0) + event.durationMs,
        );
      }

      for (const [kind, durationMs] of totals) {
        eventDurations.set(kind, [
          ...(eventDurations.get(kind) ?? []),
          durationMs,
        ]);
      }
    }

    return {
      actionP50Ms: percentileFromMetric(samples, "actionMs", 0.5),
      actionP90Ms: percentileFromMetric(samples, "actionMs", 0.9),
      durationP50Ms: percentileFromMetric(samples, "durationMs", 0.5),
      durationP90Ms: percentileFromMetric(samples, "durationMs", 0.9),
      events: Object.fromEntries(
        Array.from(eventDurations, ([kind, values]) => ({
          kind,
          value: {
            p50Ms: percentile(values, 0.5),
            p90Ms: percentile(values, 0.9),
          },
        }))
          .sort((a, b) => a.kind.localeCompare(b.kind))
          .map(({ kind, value }) => [kind, value]),
      ),
      family: first.family,
      name: first.name,
      runs: samples.length,
      settleP50Ms: percentileFromMetric(samples, "settleMs", 0.5),
      settleP90Ms: percentileFromMetric(samples, "settleMs", 0.9),
    };
  });
}

function percentileFromMetric(
  metrics: GraphPerformanceMetric[],
  key: "actionMs" | "durationMs" | "settleMs",
  rank: number,
) {
  return percentile(
    metrics.map((metric) => metric[key]),
    rank,
  );
}

function percentile(values: number[], rank: number) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * rank;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);

  if (lowerIndex === upperIndex) {
    return roundMs(sorted[lowerIndex]);
  }

  const weight = index - lowerIndex;
  return roundMs(
    sorted[lowerIndex] * (1 - weight) + sorted[upperIndex] * weight,
  );
}
