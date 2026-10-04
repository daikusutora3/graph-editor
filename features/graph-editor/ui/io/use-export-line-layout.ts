"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type LineChunk = { text: string; x: number; width: number };
type LineLayout = {
  text: string;
  chunks: LineChunk[];
  width: number;
  fontRevision: number;
};

// Keep bidi, combining characters and other shaping-sensitive scripts on the
// normal text path. The editor uses a monospace font for exported source.
function needsLineLayout(text: string) {
  return (
    text.length > 32_768 &&
    /^[\x20-\x7e\u3000-\u9fff\uff00-\uffef]+$/.test(text) &&
    !/[\p{Mark}\uff9e\uff9f]/u.test(text)
  );
}

/** Bound font measurement before mounting an exceptionally long source line. */
export function useExportLineLayout(text: string) {
  const ref = useRef<HTMLPreElement | null>(null);
  const [layout, setLayout] = useState<LineLayout | null>(null);
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  const required = useMemo(() => needsLineLayout(text), [text]);
  const [fontRevision, setFontRevision] = useState(0);

  useEffect(() => {
    const fontsChanged = () => {
      setLayout(null);
      setFallbackText(null);
      setFontRevision((value) => value + 1);
    };
    document.fonts?.addEventListener("loadingdone", fontsChanged);
    return () =>
      document.fonts?.removeEventListener("loadingdone", fontsChanged);
  }, []);

  useEffect(() => {
    if (
      !required ||
      !ref.current ||
      (layout?.text === text && layout.fontRevision === fontRevision)
    )
      return;
    let active = true;
    let frame = 0;
    const prepare = async () => {
      await document.fonts?.ready;
      if (!active || !ref.current) return;
      const style = getComputedStyle(ref.current);
      const context = document.createElement("canvas").getContext("2d");
      if (!context) {
        setFallbackText(text);
        return;
      }
      // Numeric font variants can make the computed shorthand empty.
      context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      context.fontKerning = style.fontKerning as CanvasFontKerning;
      const textRendering: Record<string, CanvasTextRendering> = {
        auto: "auto",
        optimizespeed: "optimizeSpeed",
        optimizelegibility: "optimizeLegibility",
        geometricprecision: "geometricPrecision",
      };
      context.textRendering =
        textRendering[style.textRendering.toLowerCase()] ?? "auto";
      context.letterSpacing =
        style.letterSpacing === "normal" ? "0px" : style.letterSpacing;
      const chunks: LineChunk[] = [];
      let offset = 0;
      let width = 0;
      let quoted = false;
      let escaped = false;
      const advance = () => {
        if (!active) return;
        const deadline = performance.now() + 4;
        do {
          // Keep ordinary JSON labels together, so a boundary cannot split
          // shaping within a quoted value. IDs can be arbitrarily long;
          // cap their chunks too so one measurement stays bounded.
          let end = offset;
          do {
            const character = text[end]!;
            if (escaped) escaped = false;
            else if (quoted && character === "\\") escaped = true;
            else if (character === '"') quoted = !quoted;
            end += 1;
          } while (
            end < text.length &&
            end - offset < 8_192 &&
            (end - offset < 4_096 || quoted)
          );
          const value = text.slice(offset, end);
          const chunkWidth = context.measureText(value).width;
          chunks.push({ text: value, x: width, width: chunkWidth });
          width += chunkWidth;
          offset += value.length;
        } while (offset < text.length && performance.now() < deadline);
        if (offset < text.length) {
          frame = requestAnimationFrame(advance);
        } else {
          setLayout({ text, chunks, width, fontRevision });
        }
      };
      frame = requestAnimationFrame(advance);
    };
    void prepare();
    return () => {
      active = false;
      cancelAnimationFrame(frame);
    };
  }, [fontRevision, layout, required, text]);

  const current =
    required && layout?.text === text && layout.fontRevision === fontRevision
      ? layout
      : null;

  return {
    ref,
    layout: current,
    pending: required && !current && fallbackText !== text,
  };
}
