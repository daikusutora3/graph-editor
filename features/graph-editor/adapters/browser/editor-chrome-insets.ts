type Rect = { top: number; bottom: number; height: number };

export function measureEditorChromeInsets(
  viewport: Rect,
  top?: Rect,
  bottom?: Rect,
) {
  return {
    top: top?.height
      ? Math.max(0, Math.min(viewport.height, top.bottom - viewport.top))
      : 0,
    bottom: bottom?.height
      ? Math.max(0, Math.min(viewport.height, viewport.bottom - bottom.top))
      : 0,
  };
}

export function readEditorChromeInsets(
  viewport: HTMLElement,
  { includeCanvasControls = false } = {},
) {
  const root = viewport.closest("[data-layout]");
  const rect = viewport.getBoundingClientRect();
  const insets = measureEditorChromeInsets(
    rect,
    root
      ?.querySelector<HTMLElement>("[data-editor-chrome-top]")
      ?.getBoundingClientRect(),
    root
      ?.querySelector<HTMLElement>("[data-editor-chrome-bottom]")
      ?.getBoundingClientRect(),
  );
  if (includeCanvasControls) {
    for (const selector of [
      "[data-node-creation-action]",
      "[data-canvas-zoom-controls]",
    ]) {
      const controls = root
        ?.querySelector<HTMLElement>(selector)
        ?.getBoundingClientRect();
      insets.bottom = Math.max(
        insets.bottom,
        measureEditorChromeInsets(rect, undefined, controls).bottom,
      );
    }
  }
  return insets;
}
