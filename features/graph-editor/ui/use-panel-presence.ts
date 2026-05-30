"use client";

import type { SetStateAction } from "react";
import { useCallback, useEffect, useState } from "react";

const PANEL_EXIT_DURATION_MS = 180;

export function usePanelPresence<T>(value: T | null) {
  const [presentValue, setPresentValue] = useState<T | null>(value);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (value !== null) {
      setPresentValue(value);
      setClosing(false);
      return;
    }

    if (presentValue === null) {
      setClosing(false);
      return;
    }

    setClosing(true);
    const timeout = window.setTimeout(() => {
      setPresentValue(null);
      setClosing(false);
    }, PANEL_EXIT_DURATION_MS);

    return () => window.clearTimeout(timeout);
  }, [presentValue, value]);

  return {
    closing,
    mounted: presentValue !== null,
    state: closing ? "closing" : "open",
    value: presentValue,
  } as const;
}

export function useAnimatedNullableState<T>(initialValue: T | null = null) {
  const [openValue, setOpenValue] = useState<T | null>(initialValue);
  const [presentValue, setPresentValue] = useState<T | null>(initialValue);
  const [closing, setClosing] = useState(false);

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

  const setValue = useCallback(
    (nextAction: SetStateAction<T | null>) => {
      const nextValue =
        typeof nextAction === "function"
          ? (nextAction as (current: T | null) => T | null)(openValue)
          : nextAction;

      if (nextValue === null) {
        setOpenValue(null);
        setClosing((currentClosing) => {
          if (presentValue === null) {
            return false;
          }

          return currentClosing || true;
        });
        return;
      }

      setOpenValue(nextValue);
      setPresentValue(nextValue);
      setClosing(false);
    },
    [openValue, presentValue],
  );

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
