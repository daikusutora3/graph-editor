"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_LOCALE,
  detectBrowserLocale,
  LOCALE_STORAGE_KEY,
  localeLabels,
  SUPPORTED_LOCALES,
  toLocale,
  type Locale,
} from "./locale";
import { messagesByLocale, type Messages } from "./messages";

type I18nContextValue = {
  locale: Locale;
  localeOptions: readonly { label: string; value: Locale }[];
  messages: Messages;
  setLocale: (locale: Locale) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const initialLocale = readPreferredLocale();
    setLocaleState(initialLocale);

    const onStorage = (event: StorageEvent) => {
      if (event.key !== LOCALE_STORAGE_KEY) {
        return;
      }

      const nextLocale = toLocale(event.newValue) ?? readPreferredLocale();
      setLocaleState(nextLocale);
    };

    window.addEventListener("storage", onStorage);

    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useLayoutEffect(() => applyLocale(locale), [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    writeStoredLocale(nextLocale);
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      localeOptions: SUPPORTED_LOCALES.map((value) => ({
        label: localeLabels[value],
        value,
      })),
      messages: messagesByLocale[locale],
      setLocale,
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }

  return context;
}

function readPreferredLocale(): Locale {
  const storedLocale = readStoredLocale();
  if (storedLocale) {
    return storedLocale;
  }

  const datasetLocale = toLocale(document.documentElement.dataset.locale);
  if (datasetLocale) {
    return datasetLocale;
  }

  return detectBrowserLocale(navigator.languages);
}

function applyLocale(locale: Locale) {
  const messages = messagesByLocale[locale];

  document.documentElement.lang = locale;
  document.documentElement.dataset.locale = locale;

  const applyMetadata = () => {
    if (document.documentElement.dataset.locale !== locale) {
      return;
    }

    if (document.title !== messages.app.documentTitle) {
      document.title = messages.app.documentTitle;
    }

    const description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    if (description) {
      description.content = messages.app.documentDescription;
    }
  };

  applyMetadata();
  const animationFrameId = window.requestAnimationFrame(applyMetadata);
  const timeoutIds = [
    window.setTimeout(applyMetadata, 0),
    window.setTimeout(applyMetadata, 100),
    window.setTimeout(applyMetadata, 500),
  ];

  return () => {
    window.cancelAnimationFrame(animationFrameId);
    timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
  };
}

function readStoredLocale(): Locale | null {
  try {
    return toLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeStoredLocale(locale: Locale) {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Locale application should not depend on storage availability.
  }
}
