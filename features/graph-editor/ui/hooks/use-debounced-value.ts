"use client";

import { startTransition, useEffect, useState } from "react";

export function useDebouncedValue<T>(
  value: T,
  delayMs: number,
  { transition = false }: { transition?: boolean } = {},
) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (transition) {
        startTransition(() => setDebouncedValue(value));
      } else {
        setDebouncedValue(value);
      }
    }, delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [delayMs, transition, value]);

  return debouncedValue;
}
