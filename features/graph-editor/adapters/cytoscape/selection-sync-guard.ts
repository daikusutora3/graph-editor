import type { MutableRefObject } from "react";

/**
 * Runs `fn` while Cytoscape→atom selection syncing is suppressed. Selection
 * lives in the atom, a ref and Cytoscape's own :selected state; this guard is
 * the single place that pauses the feedback loop, and it can never be left on.
 */
export function withSuppressedSelectionSync<T>(
  suppressRef: MutableRefObject<boolean>,
  fn: () => T,
): T {
  const previous = suppressRef.current;
  suppressRef.current = true;

  try {
    return fn();
  } finally {
    suppressRef.current = previous;
  }
}
