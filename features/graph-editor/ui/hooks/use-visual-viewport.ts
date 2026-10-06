"use client";

import { useLayoutEffect, type RefObject } from "react";

/** Mobile keyboards can resize the visual viewport without changing dvh. */
export function useVisualViewport(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const element = ref.current;
    const viewport = window.visualViewport;
    if (!element || !viewport) return;

    let frame = 0;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        // Keep browser zoom in control of the document when pinching.
        const mobile = window.innerWidth < 768 && viewport.scale === 1;
        element.dataset.keyboardOpen = String(
          mobile && window.innerHeight - viewport.height > 150,
        );
        element.style.setProperty(
          "--ge-viewport-height",
          mobile ? `${viewport.height}px` : "100dvh",
        );
        element.style.setProperty(
          "--ge-viewport-top",
          mobile ? `${viewport.offsetTop}px` : "0px",
        );
      });
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      window.cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      delete element.dataset.keyboardOpen;
      element.style.removeProperty("--ge-viewport-height");
      element.style.removeProperty("--ge-viewport-top");
    };
  }, [ref]);
}
