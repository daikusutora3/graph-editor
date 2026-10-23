"use client";

import { useLayoutEffect, useRef } from "react";
import { measureEditorChromeInsets } from "../../adapters/browser/editor-chrome-insets";
export {
  measureEditorChromeInsets,
  readEditorChromeInsets,
} from "../../adapters/browser/editor-chrome-insets";

/** Publish measured positions without feeding toolbar height back into itself. */
export function useEditorChromeBounds(position: "top" | "bottom") {
  const ref = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    const root = element?.closest<HTMLElement>("[data-layout]");
    if (!element || !root) return;
    const variable =
      position === "top"
        ? "--ge-top-chrome-bottom"
        : "--ge-mobile-controls-bottom";
    const update = () => {
      const rect = element.getBoundingClientRect();
      const insets = measureEditorChromeInsets(
        root.getBoundingClientRect(),
        position === "top" ? rect : undefined,
        position === "bottom" ? rect : undefined,
      );
      const value = `${position === "top" ? insets.top : insets.bottom + 12}px`;
      if (root.style.getPropertyValue(variable) !== value)
        root.style.setProperty(variable, value);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    observer.observe(root);
    return () => {
      observer.disconnect();
      root.style.removeProperty(variable);
    };
  }, [position]);
  return ref;
}
