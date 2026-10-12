"use client";

import {
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  Newspaper,
  Play,
  UserRound,
} from "lucide-react";
import { useEffect, useRef } from "react";

import { appArticlePaths, appGuidePaths } from "@/lib/site-metadata";
import { contentNavigationCopy } from "@/lib/content-navigation";
import { cn } from "@/lib/utils";

import { useI18n } from "../../i18n/I18nProvider";
import { GitHubLogo, XLogo } from "../brand/social-logos";
import { focusRing } from "@/components/ui/controls";

// Preserve the original author's profile destinations.
const AUTHOR_LINKS = [
  {
    label: "YouTube",
    href: "https://www.youtube.com/@daikusutora-dayo",
    Icon: Play,
  },
  { label: "X", href: "https://x.com/daikusutora3", Icon: XLogo },
  {
    label: "GitHub",
    href: "https://github.com/daikusutora3",
    Icon: GitHubLogo,
  },
] as const;

export function EmptyStateFooter({ mobile }: { mobile: boolean }) {
  const { locale, messages } = useI18n();
  const authorRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      const details = authorRef.current;
      if (
        details?.open &&
        event.target instanceof Node &&
        !details.contains(event.target)
      ) {
        details.open = false;
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      const details = authorRef.current;
      if (event.key === "Escape" && details?.open) {
        details.open = false;
        details.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <div
      className={cn(
        "relative inline-flex w-fit max-w-full shrink-0 items-center gap-0.5 rounded-2xl border border-[var(--line)] bg-[var(--panel-solid)] p-1",
        mobile && "flex-col",
      )}
    >
      <details ref={authorRef} className="group/author min-w-0 text-xs">
        <summary
          className={cn(
            "inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-xl px-1.5 text-[var(--text-2)] transition-colors group-open/author:bg-[var(--fill-2)] hover:bg-[var(--fill)] [&::-webkit-details-marker]:hidden",
            focusRing,
          )}
        >
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--fill)] text-[var(--text-2)] group-open/author:bg-[var(--fill-2)]">
            <UserRound
              aria-hidden="true"
              className="size-3.5"
              strokeWidth={1.75}
            />
          </span>
          <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
            <span>{messages.app.authorPrefix}</span>
            <span translate="no" className="font-medium text-[var(--text)]">
              daikusutora3
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className="size-3 shrink-0 text-[var(--muted)] transition-transform group-open/author:rotate-180"
          />
        </summary>
        <div
          className={cn(
            "absolute inset-x-0 bottom-full z-10 mb-2 flex flex-col gap-1 overflow-y-auto overscroll-contain rounded-2xl border border-[var(--line)] bg-[var(--panel-solid)] p-1",
            // Leave the toolbar, 54px footer and the popup's 8px gap uncovered.
            mobile
              ? "max-h-[max(48px,calc(var(--ge-viewport-height,100dvh)-var(--ge-mobile-controls-bottom,92px)-190px))]"
              : "max-h-[max(48px,calc(var(--ge-viewport-height,100dvh)-270px))]",
          )}
        >
          {AUTHOR_LINKS.map(({ href, label, Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "group/link flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3 text-[13px] text-[var(--text-2)] transition-colors hover:bg-[var(--fill)] hover:text-[var(--text)]",
                focusRing,
              )}
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[var(--fill)] text-[var(--muted)] group-hover/link:text-[var(--text)]">
                <Icon aria-hidden="true" className="size-3.5" />
              </span>
              <span className="flex-1 font-medium">{label}</span>
              <ArrowUpRight
                aria-hidden="true"
                className="size-3.5 text-[var(--muted)]"
              />
            </a>
          ))}
        </div>
      </details>
      {!mobile ? (
        <span
          aria-hidden="true"
          className="mx-0.5 h-5 w-px shrink-0 bg-[var(--line)]"
        />
      ) : null}
      <nav
        aria-label={contentNavigationCopy[locale].navigation}
        className="flex max-w-full flex-wrap items-center justify-center gap-0.5"
      >
        <a
          href={appGuidePaths[locale]}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-xs text-[var(--text-2)] transition-colors hover:bg-[var(--fill)] hover:text-[var(--text)] active:bg-[var(--fill-2)]",
            focusRing,
          )}
        >
          <BookOpen aria-hidden="true" className="size-3.5" />
          {messages.appMenu.guide}
          <span className="sr-only">
            ({contentNavigationCopy[locale].newTab})
          </span>
        </a>
        <a
          href={appArticlePaths[locale]}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-xs text-[var(--text-2)] transition-colors hover:bg-[var(--fill)] hover:text-[var(--text)] active:bg-[var(--fill-2)]",
            focusRing,
          )}
        >
          <Newspaper aria-hidden="true" className="size-3.5" />
          {contentNavigationCopy[locale].articles}
          <span className="sr-only">
            ({contentNavigationCopy[locale].newTab})
          </span>
        </a>
      </nav>
    </div>
  );
}
