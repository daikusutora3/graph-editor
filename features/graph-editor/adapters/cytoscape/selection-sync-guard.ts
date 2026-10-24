import type { MutableRefObject } from "react";

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
