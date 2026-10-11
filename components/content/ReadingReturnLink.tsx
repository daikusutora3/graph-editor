"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { actionStyles } from "@/components/ui/styles";
import { contentNavigationCopy } from "@/lib/content-navigation";
import {
  parseReadingPosition,
  readingRestoreKey,
  readingReturnKey,
  type ReadingPosition,
} from "@/lib/reading-position";
import type { AppLocale } from "@/lib/site-metadata";

export function ReadingReturnLink({ locale }: { locale: AppLocale }) {
  const [position, setPosition] = useState<ReadingPosition | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const pathname = usePathname();
  useEffect(() => {
    try {
      setPosition(
        parseReadingPosition(
          sessionStorage.getItem(readingReturnKey(locale)),
          locale,
        ),
      );
    } catch {
      setPosition(null);
    }
  }, [locale, pathname]);
  useEffect(() => {
    const header = document.querySelector<HTMLElement>("[data-content-header]");
    if (!header) return;
    const update = () => setHeaderHeight(header.getBoundingClientRect().height);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  if (!position) return null;
  return (
    <div
      style={{ top: headerHeight }}
      className="sticky z-10 border-b border-[var(--line)] bg-[var(--panel-solid)]"
    >
      <div className="mx-auto max-w-6xl px-4 py-2 sm:px-8">
        <Link
          href={`${position.path}${position.section ? `#${position.section}` : ""}`}
          prefetch={false}
          className={actionStyles("soft")}
          onClick={(event) => {
            if (
              event.button !== 0 ||
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey
            )
              return;
            try {
              sessionStorage.setItem(
                readingRestoreKey(locale),
                JSON.stringify(position),
              );
            } catch {
              /* The section link still works without storage. */
            }
          }}
        >
          <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
          {contentNavigationCopy[locale].returnArticle}
        </Link>
      </div>
    </div>
  );
}

/** Restore only an explicit guide-to-article return; normal links retain browser scrolling. */
export function ReadingPositionRestore({ locale }: { locale: AppLocale }) {
  const pathname = usePathname();
  useEffect(() => {
    let position: ReadingPosition | null = null;
    try {
      position = parseReadingPosition(
        sessionStorage.getItem(readingRestoreKey(locale)),
        locale,
      );
      if (!position || position.path !== pathname) return;
    } catch {
      return;
    }
    const scrollY = position.scrollY;
    let nextFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      nextFrame = requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY, behavior: "instant" });
        try {
          const current = parseReadingPosition(
            sessionStorage.getItem(readingRestoreKey(locale)),
            locale,
          );
          if (
            current?.path === position?.path &&
            current?.scrollY === scrollY &&
            current?.section === position?.section
          )
            sessionStorage.removeItem(readingRestoreKey(locale));
        } catch {
          /* Scrolling does not depend on storage cleanup. */
        }
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(nextFrame);
    };
  }, [locale, pathname]);
  return null;
}
