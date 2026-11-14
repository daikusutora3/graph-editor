"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const PANEL_EXIT_DURATION_MS = 180;

export function useAnimatedNullableState<T>() {
  const [openValue, setOpenValue] = useState<T | null>(null);
  const [presentValue, setPresentValue] = useState<T | null>(null);
  const [closing, setClosing] = useState(false);
  const presentValueRef = useRef(presentValue);

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

  const setValue = useCallback((nextValue: T | null) => {
    if (nextValue === null) {
      setOpenValue(null);
      setClosing(() => presentValueRef.current !== null);
      return;
    }

    presentValueRef.current = nextValue;
    setOpenValue(nextValue);
    setPresentValue(nextValue);
    setClosing(false);
  }, []);

  return {
    openValue,
    panelPresence: {
      state: closing ? "closing" : "open",
      value: presentValue,
    },
    setValue,
  } as const;
}

export function usePresence<T>(value: T | null) {
  const [presentValue, setPresentValue] = useState<T | null>(value);

  useEffect(() => {
    if (value !== null) {
      setPresentValue(value);
      return;
    }

    const timeout = window.setTimeout(
      () => setPresentValue(null),
      PANEL_EXIT_DURATION_MS,
    );

    return () => window.clearTimeout(timeout);
  }, [value]);

  const visibleValue = value ?? presentValue;

  return {
    state: value === null && presentValue !== null ? "closing" : "open",
    value: visibleValue,
  } as const;
}
