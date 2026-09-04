"use client";

import { useEffect, useState } from "react";

/** True while Shift/Meta/Ctrl is held, which turns drags into range selection. */
export function useRangeSelectionKey() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const sync = (event: KeyboardEvent) => {
      setActive(event.shiftKey || event.metaKey || event.ctrlKey);
    };
    const reset = () => setActive(false);

    window.addEventListener("keydown", sync);
    window.addEventListener("keyup", sync);
    window.addEventListener("blur", reset);

    return () => {
      window.removeEventListener("keydown", sync);
      window.removeEventListener("keyup", sync);
      window.removeEventListener("blur", reset);
    };
  }, []);

  return active;
}
