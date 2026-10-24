import { clearNodeMeasurements } from "./node-geometry";

function readTypographySignature() {
  const style = getComputedStyle(document.documentElement);
  return JSON.stringify([
    style.fontSize,
    style.fontFamily,
    ...[
      "--canvas-node-size",
      "--canvas-node-font",
      "--canvas-edge-font",
      "--canvas-font",
      "--canvas-label-padding",
    ].map((name) => style.getPropertyValue(name)),
  ]);
}

export function observeCanvasTypography(onChange: () => void) {
  let active = true;
  let signature = readTypographySignature();
  const check = (fontLoaded = false) => {
    if (!active) return;
    const next = readTypographySignature();
    if (!fontLoaded && next === signature) return;
    signature = next;

    clearNodeMeasurements();
    onChange();
  };
  const onMetrics = () => check();
  const onFonts = () => check(true);
  document.fonts?.addEventListener("loadingdone", onFonts);
  const mutations = new MutationObserver(onMetrics);
  mutations.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["style", "class", "data-locale", "data-theme"],
  });

  const probe = document.createElement("span");
  probe.setAttribute("aria-hidden", "true");
  probe.inert = true;
  probe.style.cssText =
    "position:fixed;top:0;left:0;width:1rem;height:1rem;visibility:hidden;pointer-events:none;contain:strict";
  document.body.append(probe);
  const resize = new ResizeObserver(onMetrics);
  resize.observe(probe);
  window.addEventListener("resize", onMetrics, { passive: true });
  return () => {
    active = false;
    mutations.disconnect();
    resize.disconnect();
    probe.remove();
    window.removeEventListener("resize", onMetrics);
    document.fonts?.removeEventListener("loadingdone", onFonts);
  };
}
