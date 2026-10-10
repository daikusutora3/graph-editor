import { hasGraphCoordinatePositions } from "../core/graph/graph-coordinates";
import type { ComputeJob } from "./worker-protocol";

/** The client and Worker reject the same unsupported coordinate range. */
export function hasComputeJobCoordinates(job: ComputeJob) {
  try {
    if (
      !Array.isArray(job.model.nodes) ||
      !hasGraphCoordinatePositions(job.model.nodes)
    )
      return false;
    if (job.kind !== "routing" || !job.interaction) return true;
    const previous =
      "previousNodes" in job.interaction
        ? job.interaction.previousNodes
        : job.interaction.nodes;
    return Array.isArray(previous) && hasGraphCoordinatePositions(previous);
  } catch {
    return false;
  }
}
