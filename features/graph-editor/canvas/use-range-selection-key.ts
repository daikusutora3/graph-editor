"use client";

import { useEffect, useState } from "react";

/** True while Shift/Meta/Ctrl is held, which turns drags into range selection. */
export function useRangeSelectionKey() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const sync = (event: KeyboardEvent | PointerEvent) => {
      setActive(event.shiftKey || event.metaKey || event.ctrlKey);
    };
    const reset = () => setActive(false);

    window.addEventListener("keydown", sync);
    window.addEventListener("keyup", sync);
    // A pointer interaction also gives the current modifiers after focus changes.
    window.addEventListener("pointerdown", sync, true);
    window.addEventListener("blur", reset);

    return () => {
      window.removeEventListener("keydown", sync);
      window.removeEventListener("keyup", sync);
      window.removeEventListener("pointerdown", sync, true);
      window.removeEventListener("blur", reset);
    };
  }, []);

  return active;
}
