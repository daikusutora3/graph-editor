"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Measure the header so anchor targets stay visible at every viewport width. */
export function ContentStickyHeader({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const header = ref.current;
    const page = header?.closest("main");
    if (!header || !page) return;
    let headerWidth = header.getBoundingClientRect().width;
    let visibleTarget: HTMLElement | null = null;
    const getTarget = () => {
      const target = document.getElementById(window.location.hash.slice(1));
      return target && page.contains(target) ? target : null;
    };
    const rememberVisibleTarget = () => {
      // A resize may dispatch a layout-induced scroll before its resize event.
      // Keep the pre-resize destination until the new width is reconciled.
      if (header.getBoundingClientRect().width !== headerWidth) return;
      const target = getTarget();
      const top = target?.getBoundingClientRect().top;
      visibleTarget =
        target &&
        top !== undefined &&
        top >= header.getBoundingClientRect().height &&
        top < window.innerHeight
          ? target
          : null;
    };
    const update = (previouslyVisible: HTMLElement | null = null) => {
      const bounds = header.getBoundingClientRect();
      const restore =
        previouslyVisible ??
        (bounds.width !== headerWidth ? visibleTarget : null);
      headerWidth = bounds.width;
      page.style.setProperty(
        "--reading-header-height",
        `${Math.ceil(bounds.height)}px`,
      );
      // Reveal a destination covered by a resized header without moving
      // back to an anchor already read past.
      const target = getTarget();
      if (!target) {
        visibleTarget = null;
        return;
      }
      const top = target.getBoundingClientRect().top;
      const inset = Number.parseFloat(getComputedStyle(target).scrollMarginTop);
      if ((top >= 0 || target === restore) && top < inset)
        target.scrollIntoView({ block: "start", behavior: "instant" });
      rememberVisibleTarget();
    };
    const resize = () => update(visibleTarget);
    update();
    const observer = new ResizeObserver(() => update());
    observer.observe(header);
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", rememberVisibleTarget, { passive: true });
    window.addEventListener("hashchange", rememberVisibleTarget);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", rememberVisibleTarget);
      window.removeEventListener("hashchange", rememberVisibleTarget);
      page.style.removeProperty("--reading-header-height");
    };
  }, []);
  return (
    <div ref={ref} className="sticky top-0 z-20">
      {children}
    </div>
  );
}
