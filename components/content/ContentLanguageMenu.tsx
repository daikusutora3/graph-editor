"use client";

import { Check, ChevronDown, Languages } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { actionStyles } from "@/components/ui/styles";
import type { AppLocale } from "@/lib/site-metadata";
import { cn } from "@/lib/utils";

export function ContentLanguageMenu({
  label,
  current,
  options,
  preserveGuideSection = false,
}: {
  preserveGuideSection?: boolean;
  label: string;
  current: AppLocale;
  options: readonly { locale: AppLocale; name: string; href: string }[];
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [fragment, setFragment] = useState("");
  useEffect(() => {
    if (!preserveGuideSection) return;
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
  }, [preserveGuideSection]);
  useEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !menu.contains(event.target))
        menu.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !menu.open) return;
      menu.open = false;
      menu.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  return (
    <nav aria-label={label} className="shrink-0">
      <details ref={ref} className="group relative">
        <summary
          className={cn(
            actionStyles(),
            "min-w-11 cursor-pointer list-none justify-center gap-1.5 text-xs [&::-webkit-details-marker]:hidden",
          )}
          aria-label={`${label}: ${options.find((option) => option.locale === current)?.name}`}
        >
          <Languages className="size-4 shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline">
            {options.find((option) => option.locale === current)?.name}
          </span>
          <ChevronDown
            className="size-3 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none max-[319px]:hidden"
            aria-hidden="true"
          />
        </summary>
        <div className="absolute top-full right-0 z-30 mt-1 w-40 rounded-xl border border-[var(--line)] bg-[var(--panel-solid)] p-1 shadow-lg">
          {options.map((option) => (
            <a
              key={option.locale}
              href={`${option.href}${fragment}`}
              hrefLang={option.locale}
              lang={option.locale}
              aria-current={option.locale === current ? "page" : undefined}
              className={cn(
                actionStyles(),
                "w-full justify-between text-sm aria-[current=page]:bg-[var(--fill)] aria-[current=page]:font-semibold",
              )}
            >
              {option.name}
              {option.locale === current ? (
                <Check className="size-3.5" aria-hidden="true" />
              ) : null}
            </a>
          ))}
        </div>
      </details>
    </nav>
  );
}
