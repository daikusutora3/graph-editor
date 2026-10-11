"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Measure the complete sticky area, including an optional article-return bar. */
export function GuideStickyHeader({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const header = ref.current;
    const page = header?.closest("main");
    if (!header || !page) return;
    const update = () => {
      page.style.setProperty(
        "--guide-header-height",
        `${Math.ceil(header.getBoundingClientRect().height)}px`,
      );
      // A return bar may mount after anchor navigation. Reveal a covered
      // destination, without jumping back to an anchor already read past.
      const target = document.getElementById(window.location.hash.slice(1));
      if (!target || !page.contains(target)) return;
      const top = target.getBoundingClientRect().top;
      const inset = Number.parseFloat(getComputedStyle(target).scrollMarginTop);
      if (top >= 0 && top < inset)
        target.scrollIntoView({ block: "start", behavior: "instant" });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => {
      observer.disconnect();
      page.style.removeProperty("--guide-header-height");
    };
  }, []);
  return (
    <div ref={ref} className="sticky top-0 z-20">
      {children}
    </div>
  );
}
