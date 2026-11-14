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
import { ActionRow, LinkButton, buttonClass } from "@/components/ui/controls";
import { menuStyle } from "@/components/ui/surfaces";

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
    <div className="relative flex w-full max-w-full shrink-0 flex-wrap items-center justify-center gap-x-1 gap-y-0.5 text-xs text-[var(--muted)]">
      <details ref={authorRef} className="group/author relative min-w-0">
        <summary
          className={cn(
            buttonClass({ size: "sm" }),
            "cursor-pointer list-none gap-1.5 pr-2 pl-1 font-normal text-[var(--muted)] group-open/author:bg-[var(--fill)] [&::-webkit-details-marker]:hidden",
          )}
        >
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--fill)] text-[var(--text-2)] group-open/author:bg-[var(--fill-2)]">
            <UserRound
              aria-hidden="true"
              className="size-3"
              strokeWidth={1.75}
            />
          </span>
          <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
            <span>{messages.app.authorPrefix}</span>
            <span translate="no" className="font-semibold text-[var(--text-2)]">
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
            menuStyle.surface,
            "ge-pop absolute bottom-full left-1/2 z-10 mb-2 flex w-52 -translate-x-1/2 flex-col gap-0.5 overflow-y-auto overscroll-contain",

            mobile
              ? "max-h-[max(48px,calc(var(--ge-viewport-height,100dvh)-var(--ge-mobile-controls-bottom,92px)-190px))]"
              : "max-h-[max(48px,calc(var(--ge-viewport-height,100dvh)-270px))]",
          )}
        >
          {AUTHOR_LINKS.map(({ href, label, Icon }) => (
            <ActionRow
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              density="menu"
              icon={
                <Icon
                  aria-hidden="true"
                  className="size-3.5 text-[var(--muted)]"
                />
              }
              trailing={
                <ArrowUpRight aria-hidden="true" className="size-3.5" />
              }
            >
              {label}
            </ActionRow>
          ))}
        </div>
      </details>
      <span
        aria-hidden="true"
        className={cn("text-[var(--disabled)]", mobile && "hidden")}
      >
        ·
      </span>
      <nav
        aria-label={contentNavigationCopy[locale].navigation}
        className={cn(
          "flex max-w-full flex-wrap items-center justify-center gap-x-1",
          mobile && "w-full",
        )}
      >
        <LinkButton
          href={appGuidePaths[locale]}
          external
          newTabLabel={contentNavigationCopy[locale].newTab}
          className="font-normal text-[var(--muted)]"
          icon={<BookOpen aria-hidden="true" className="size-3.5" />}
        >
          {messages.appMenu.guide}
        </LinkButton>
        <span aria-hidden="true" className="text-[var(--disabled)]">
          ·
        </span>
        <LinkButton
          href={appArticlePaths[locale]}
          external
          newTabLabel={contentNavigationCopy[locale].newTab}
          className="font-normal text-[var(--muted)]"
          icon={<Newspaper aria-hidden="true" className="size-3.5" />}
        >
          {contentNavigationCopy[locale].articles}
        </LinkButton>
      </nav>
    </div>
  );
}
