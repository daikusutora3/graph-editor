import { useEffect, useState } from "react";

export function useTimedState<T>(idle: T, durationMs: number) {
  const [value, setValue] = useState<T>(idle);

  useEffect(() => {
    if (value === idle) {
      return;
    }

    const timeoutId = window.setTimeout(() => setValue(idle), durationMs);

    return () => window.clearTimeout(timeoutId);
  }, [durationMs, idle, value]);

  return [value, setValue] as const;
}
