"use client";

import { useEffect, useState, type ComponentType } from "react";

export function GraphPerformanceProbeLoader() {
  const [Probe, setProbe] = useState<ComponentType | null>(null);

  useEffect(() => {
    if (
      process.env.NODE_ENV === "production" &&
      process.env.NEXT_PUBLIC_ENABLE_PERF_PROBE !== "1"
    ) {
      return;
    }

    const params = new URLSearchParams(window.location.search);

    if (params.get("perf") !== "1") {
      return;
    }

    let mounted = true;

    void import("./GraphPerformanceProbe").then((module) => {
      if (mounted) {
        setProbe(() => module.GraphPerformanceProbe);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  return Probe ? <Probe /> : null;
}
