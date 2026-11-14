import { hasGraphCoordinatePositions } from "../core/graph/graph-coordinates";
import type { ComputeJob } from "./worker-protocol";

export function hasComputeJobCoordinates(job: ComputeJob) {
  try {
    if (
      !Array.isArray(job.model.nodes) ||
      !hasGraphCoordinatePositions(job.model.nodes)
    )
      return false;
    if (job.kind !== "routing" || !job.interaction) return true;
    const previous = job.interaction.previousNodes;
    return Array.isArray(previous) && hasGraphCoordinatePositions(previous);
  } catch {
    return false;
  }
}
