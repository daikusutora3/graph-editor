"use client";

import { useEffect, useMemo, useState } from "react";
import type { GraphModel } from "../../core/graph/model";
import {
  createGraphExportTask,
  exportGraph,
  type GraphExportFormat,
} from "../../io/export-graph";

const emptyResult = { text: "", blocked: false, pending: false };

export function useGraphExport(
  graph: GraphModel | null,
  format: GraphExportFormat,
  enabled: boolean,
) {
  const [completed, setCompleted] = useState<{
    graph: GraphModel;
    text: string;
    blocked: boolean;
  } | null>(null);
  const result = useMemo(() => {
    if (!enabled || !graph) return emptyResult;
    if (format === "tikz" && graph.nodes.length > 0) {
      return completed?.graph === graph
        ? { text: completed.text, blocked: completed.blocked, pending: false }
        : { text: "", blocked: false, pending: true };
    }
    try {
      return {
        text: exportGraph(graph, format),
        blocked: false,
        pending: false,
      };
    } catch {
      return { text: "", blocked: true, pending: false };
    }
  }, [completed, enabled, format, graph]);

  useEffect(() => {
    if (
      !enabled ||
      !graph ||
      format !== "tikz" ||
      graph.nodes.length === 0 ||
      completed?.graph === graph
    )
      return;
    const task = createGraphExportTask(graph, format);
    let frame = 0;
    let active = true;
    const advance = () => {
      if (!active) return;
      try {
        const deadline = performance.now() + 4;
        let step = task.next();
        while (!step.done && performance.now() < deadline) step = task.next();
        if (step.done) {
          setCompleted({ graph, text: step.value, blocked: false });
        } else {
          frame = requestAnimationFrame(advance);
        }
      } catch {
        setCompleted({ graph, text: "", blocked: true });
      }
    };
    frame = requestAnimationFrame(advance);
    return () => {
      active = false;
      cancelAnimationFrame(frame);
    };
  }, [completed, enabled, format, graph]);
  return result;
}
