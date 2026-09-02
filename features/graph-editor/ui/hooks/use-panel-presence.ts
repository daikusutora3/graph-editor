"use client";

import type { SetStateAction } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

const PANEL_EXIT_DURATION_MS = 180;

export function useAnimatedNullableState<T>(initialValue: T | null = null) {
  const [openValue, setOpenValue] = useState<T | null>(initialValue);
  const [presentValue, setPresentValue] = useState<T | null>(initialValue);
  const [closing, setClosing] = useState(false);
  const openValueRef = useRef(openValue);
  const presentValueRef = useRef(presentValue);

  openValueRef.current = openValue;
  presentValueRef.current = presentValue;

  useEffect(() => {
    if (!closing) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setPresentValue(null);
      setClosing(false);
    }, PANEL_EXIT_DURATION_MS);

    return () => window.clearTimeout(timeout);
  }, [closing]);

  const setValue = useCallback((nextAction: SetStateAction<T | null>) => {
    const nextValue =
      typeof nextAction === "function"
        ? (nextAction as (current: T | null) => T | null)(openValueRef.current)
        : nextAction;

    if (nextValue === null) {
      openValueRef.current = null;
      setOpenValue(null);
      setClosing(() => {
        if (presentValueRef.current === null) {
          return false;
        }

        return true;
      });
      return;
    }

    openValueRef.current = nextValue;
    presentValueRef.current = nextValue;
    setOpenValue(nextValue);
    setPresentValue(nextValue);
    setClosing(false);
  }, []);

  return {
    openValue,
    panelPresence: {
      closing,
      mounted: presentValue !== null,
      state: closing ? "closing" : "open",
      value: presentValue,
    },
    setValue,
  } as const;
}

export function usePresence<T>(
  value: T | null,
  exitDurationMs = PANEL_EXIT_DURATION_MS,
) {
  const [presentValue, setPresentValue] = useState<T | null>(value);

  useEffect(() => {
    if (value !== null) {
      setPresentValue(value);
      return;
    }

    const timeout = window.setTimeout(
      () => setPresentValue(null),
      exitDurationMs,
    );

    return () => window.clearTimeout(timeout);
  }, [exitDurationMs, value]);

  const visibleValue = value ?? presentValue;

  return {
    mounted: visibleValue !== null,
    state: value === null && presentValue !== null ? "closing" : "open",
    value: visibleValue,
  } as const;
}
