"use client";

import { useEffect, useState } from "react";
import { ContentLanguageSwitcher } from "@/components/content/ContentNavigation";
import type { AppLocale } from "@/lib/site-metadata";

/** Language links retain the current guide section; SSR keeps crawlable URLs. */
export function GuideLanguageSwitcher({ locale }: { locale: AppLocale }) {
  const [fragment, setFragment] = useState("");
  useEffect(() => {
    const update = () => {
      const hash = window.location.hash;
      const target = document.getElementById(hash.slice(1));
      setFragment(
        target?.closest("#guide-content") || target?.id === "guide-top"
          ? hash
          : "",
      );
    };
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return (
    <ContentLanguageSwitcher
      locale={locale}
      section="guide"
      fragment={fragment}
    />
  );
}
