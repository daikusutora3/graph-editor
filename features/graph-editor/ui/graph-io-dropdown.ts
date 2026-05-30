"use client";

import type { RefObject } from "react";
import { useEffect, useState } from "react";

export type GraphIOOpenPanel = "export" | "screenshot";

type GraphIODropdownOptions = {
  panelRef: RefObject<HTMLElement | null>;
  railRef: RefObject<HTMLDivElement | null>;
};

export function useGraphIODropdown({
  panelRef,
  railRef,
}: GraphIODropdownOptions) {
  const [openPanel, setOpenPanel] = useState<GraphIOOpenPanel | null>(null);
  const exportOpen = openPanel === "export";
  const screenshotOpen = openPanel === "screenshot";
  const panelOpen = openPanel !== null;

  useEffect(() => {
    if (!panelOpen) {
      return;
    }

    const closeMenus = () => setOpenPanel(null);

    const onPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        (railRef.current?.contains(event.target) ||
          panelRef.current?.contains(event.target))
      ) {
        return;
      }

      closeMenus();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenus();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [panelOpen, panelRef, railRef]);

  return {
    exportOpen,
    openPanel,
    screenshotOpen,
    setOpenPanel,
  };
}
