"use client";

export type GraphPerformanceEvent = {
  durationMs: number;
  kind: string;
  meta?: Record<string, number | string | boolean | null>;
};

declare global {
  interface Window {
    __graphPerfEvents?: GraphPerformanceEvent[];
  }
}

export function recordGraphPerformanceEvent(
  kind: string,
  durationMs: number,
  meta?: GraphPerformanceEvent["meta"],
) {
  const events =
    typeof window === "undefined" ? undefined : window.__graphPerfEvents;

  if (!events) {
    return;
  }

  events.push({
    durationMs: roundMs(durationMs),
    kind,
    meta,
  });
}

export function recordTimedEvent<T>(
  kind: string,
  read: () => T,
  meta?: GraphPerformanceEvent["meta"],
) {
  const events =
    typeof window === "undefined" ? undefined : window.__graphPerfEvents;

  if (!events || typeof performance === "undefined") {
    return read();
  }

  const start = performance.now();

  try {
    return read();
  } finally {
    events.push({
      durationMs: roundMs(performance.now() - start),
      kind,
      meta,
    });
  }
}

export function roundMs(value: number) {
  return Math.round(value * 10) / 10;
}
