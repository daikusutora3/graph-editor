"use client";

import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { useCallback, useEffect, useRef } from "react";

type UseRangeSelectionPointerForwardingOptions = {
  containerRef: RefObject<HTMLDivElement | null>;
  enabled: boolean;
};

type ForwardedMouseEventType = "mousedown" | "mousemove" | "mouseup";

export function useRangeSelectionPointerForwarding({
  containerRef,
  enabled,
}: UseRangeSelectionPointerForwardingOptions) {
  const stopForwardingRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      stopForwardingRef.current?.();
    };
  }, []);

  return useCallback(
    (event: ReactPointerEvent<Element>) => {
      if (
        !enabled ||
        event.button !== 0 ||
        (!event.shiftKey && !event.metaKey && !event.ctrlKey)
      ) {
        return false;
      }

      const canvas = containerRef.current?.querySelector("canvas");

      if (!canvas) {
        return false;
      }

      stopForwardingRef.current?.();
      event.preventDefault();
      event.stopPropagation();
      dispatchCanvasMouseEvent(canvas, "mousedown", event.nativeEvent);

      const forwardPointerMove = (moveEvent: PointerEvent) => {
        moveEvent.preventDefault();
        moveEvent.stopPropagation();
        dispatchCanvasMouseEvent(canvas, "mousemove", moveEvent);
      };
      const stopForwarding = () => {
        window.removeEventListener("pointermove", forwardPointerMove, true);
        window.removeEventListener("pointerup", forwardPointerUp, true);
        window.removeEventListener("pointercancel", forwardPointerCancel, true);
        stopForwardingRef.current = null;
      };
      const forwardPointerUp = (upEvent: PointerEvent) => {
        upEvent.preventDefault();
        upEvent.stopPropagation();
        dispatchCanvasMouseEvent(canvas, "mouseup", upEvent);
        stopForwarding();
      };
      const forwardPointerCancel = (cancelEvent: PointerEvent) => {
        cancelEvent.preventDefault();
        cancelEvent.stopPropagation();
        dispatchCanvasMouseEvent(canvas, "mouseup", cancelEvent);
        stopForwarding();
      };

      window.addEventListener("pointermove", forwardPointerMove, true);
      window.addEventListener("pointerup", forwardPointerUp, true);
      window.addEventListener("pointercancel", forwardPointerCancel, true);
      stopForwardingRef.current = stopForwarding;

      return true;
    },
    [containerRef, enabled],
  );
}

function dispatchCanvasMouseEvent(
  canvas: HTMLCanvasElement,
  type: ForwardedMouseEventType,
  event: MouseEvent,
) {
  canvas.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      button: event.button,
      buttons: event.buttons,
      cancelable: true,
      clientX: event.clientX,
      clientY: event.clientY,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      screenX: event.screenX,
      screenY: event.screenY,
    }),
  );
}
