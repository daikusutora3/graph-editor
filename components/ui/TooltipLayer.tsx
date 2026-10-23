"use client";

import { useEffect, useId } from "react";

import {
  getTooltipPosition,
  TOOLTIP_MARGIN,
  type TooltipRect,
  type TooltipSide,
} from "./tooltip-position";

function triggerFrom(target: EventTarget | null) {
  return target instanceof Element
    ? target.closest<HTMLElement>("[data-tooltip]")
    : null;
}

function canShow(trigger: HTMLElement) {
  return (
    trigger.isConnected &&
    Boolean(trigger.dataset.tooltip) &&
    trigger.getAttribute("aria-expanded") !== "true" &&
    !trigger
      .closest('[role="toolbar"]')
      ?.querySelector("[data-range-selection-controls]")
  );
}

function visibleViewport(): TooltipRect {
  const viewport = window.visualViewport;
  return {
    left: viewport?.offsetLeft ?? 0,
    top: viewport?.offsetTop ?? 0,
    width: viewport?.width ?? document.documentElement.clientWidth,
    height: viewport?.height ?? document.documentElement.clientHeight,
  };
}

/** One document-level tooltip also covers raw data-tooltip controls. */
export function TooltipLayer() {
  const id = useId();

  useEffect(() => {
    // Render outside panels so their scrolling and transforms cannot clip it.
    const tooltip = document.createElement("div");
    tooltip.id = id;
    tooltip.className = "ge-tooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.hidden = true;
    document.body.append(tooltip);

    let anchor: HTMLElement | null = null;
    let hovered: HTMLElement | null = null;
    let focused: HTMLElement | null = null;
    let dismissed: HTMLElement | null = null;
    let keyboardFocus = false;
    let tooltipHovered = false;
    let timer: number | undefined;
    let hideTimer: number | undefined;

    const cancelHide = () => {
      window.clearTimeout(hideTimer);
      hideTimer = undefined;
    };

    const hide = () => {
      cancelHide();
      window.clearTimeout(timer);
      timer = undefined;
      tooltipHovered = false;
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      if (anchor) {
        const descriptions = (anchor.getAttribute("aria-describedby") ?? "")
          .split(/\s+/)
          .filter((value) => value && value !== id);
        if (descriptions.length) {
          anchor.setAttribute("aria-describedby", descriptions.join(" "));
        } else {
          anchor.removeAttribute("aria-describedby");
        }
      }
      anchor = null;
      tooltip.hidden = true;
    };

    const position = () => {
      if (!anchor || !canShow(anchor)) {
        hide();
        return;
      }
      const viewport = visibleViewport();
      const rect = anchor.getBoundingClientRect();
      if (
        rect.width === 0 ||
        rect.height === 0 ||
        rect.right <= viewport.left ||
        rect.bottom <= viewport.top ||
        rect.left >= viewport.left + viewport.width ||
        rect.top >= viewport.top + viewport.height
      ) {
        hide();
        return;
      }
      const text = anchor.dataset.tooltip ?? "";
      if (tooltip.textContent !== text) tooltip.textContent = text;
      tooltip.style.maxWidth = `${Math.max(0, Math.min(240, viewport.width - TOOLTIP_MARGIN * 2))}px`;
      tooltip.style.maxHeight = `${Math.max(0, viewport.height - TOOLTIP_MARGIN * 2)}px`;
      const { left, top } = getTooltipPosition(
        rect,
        tooltip.getBoundingClientRect(),
        viewport,
        anchor.dataset.tooltipSide as TooltipSide | undefined,
      );
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    };

    const resizeObserver = new ResizeObserver(position);
    const mutationObserver = new MutationObserver(position);

    const sync = () => {
      const next =
        hovered && canShow(hovered)
          ? hovered
          : tooltipHovered && anchor && canShow(anchor)
            ? anchor
            : focused && canShow(focused)
              ? focused
              : null;
      if (next && next === dismissed) return;
      dismissed = null;
      if (next === anchor) {
        cancelHide();
        return;
      }
      // The tooltip is separated from its trigger by a small gap. Keep an
      // already visible hint while the pointer crosses it, without delaying
      // cancellation of a hint that has not appeared yet.
      if (!next && anchor && !tooltip.hidden) {
        hideTimer ??= window.setTimeout(hide, 150);
        return;
      }
      hide();
      if (!next || !canShow(next)) return;
      anchor = next;
      timer = window.setTimeout(
        () => {
          timer = undefined;
          if (!anchor || !canShow(anchor)) {
            hide();
            return;
          }
          tooltip.hidden = false;
          position();
          if (!anchor) return;
          const descriptions = anchor.getAttribute("aria-describedby");
          anchor.setAttribute(
            "aria-describedby",
            descriptions ? `${descriptions} ${id}` : id,
          );
          resizeObserver.observe(anchor);
          resizeObserver.observe(tooltip);
          mutationObserver.observe(document.body, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: [
              "data-tooltip",
              "data-tooltip-side",
              "aria-expanded",
              "data-range-selection-controls",
            ],
          });
        },
        next === focused ? 0 : 350,
      );
    };

    const onPointerOver = (event: PointerEvent) => {
      if (
        event.pointerType === "touch" ||
        !window.matchMedia("(hover: hover)").matches
      ) {
        return;
      }
      tooltipHovered = event.target === tooltip;
      hovered = tooltipHovered ? null : triggerFrom(event.target);
      sync();
    };
    const onPointerOut = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      if (event.target === tooltip) {
        tooltipHovered = false;
        hovered = triggerFrom(event.relatedTarget);
        sync();
        return;
      }
      if (triggerFrom(event.relatedTarget) === triggerFrom(event.target)) {
        return;
      }
      tooltipHovered = event.relatedTarget === tooltip;
      hovered = tooltipHovered ? null : triggerFrom(event.relatedTarget);
      sync();
    };
    const onFocusIn = (event: FocusEvent) => {
      const trigger = triggerFrom(event.target);
      focused =
        trigger && (keyboardFocus || trigger.matches(":focus-visible"))
          ? trigger
          : null;
      if (focused) {
        hovered = null;
        tooltipHovered = false;
      }
      sync();
    };
    const onFocusOut = () => {
      focused = null;
      // Keyboard navigation should not wait for the pointer crossing delay.
      if (!hovered && !tooltipHovered) hide();
      sync();
    };
    const dismiss = () => {
      dismissed = anchor ?? dismissed;
      hide();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      keyboardFocus = true;
      if (event.key === "Escape") dismiss();
    };
    const onPointerDown = () => {
      keyboardFocus = false;
      dismiss();
    };

    document.addEventListener("pointerover", onPointerOver, true);
    document.addEventListener("pointerout", onPointerOut, true);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", onFocusOut, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("scroll", dismiss, true);
    window.addEventListener("blur", dismiss);
    window.addEventListener("resize", position);
    window.visualViewport?.addEventListener("resize", position);
    window.visualViewport?.addEventListener("scroll", position);

    return () => {
      dismiss();
      tooltip.remove();
      document.removeEventListener("pointerover", onPointerOver, true);
      document.removeEventListener("pointerout", onPointerOut, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusout", onFocusOut, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("blur", dismiss);
      window.removeEventListener("resize", position);
      window.visualViewport?.removeEventListener("resize", position);
      window.visualViewport?.removeEventListener("scroll", position);
    };
  }, [id]);

  return null;
}
