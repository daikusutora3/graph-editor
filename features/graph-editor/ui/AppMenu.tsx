"use client";

import { CircleDot, ExternalLink, Share2 } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { useEffect, useRef } from "react";

import { getAppLocaleUrl } from "@/lib/site-metadata";

import { GitHubLogo, XLogo } from "./AuthorProfileMenu";
import { useI18n } from "../i18n/I18nProvider";

const APP_REPOSITORY_URL = "https://github.com/daikusutora3/graph-editor";
const APP_ISSUES_URL = `${APP_REPOSITORY_URL}/issues/new`;

type AppMenuProps = {
  boundaryRef?: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
};

export function AppMenu({ boundaryRef, open, onClose }: AppMenuProps) {
  const { locale, messages } = useI18n();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const shareUrl = createXShareUrl({
    text: `${messages.app.title} - ${messages.app.description}`,
    url: getAppLocaleUrl(locale),
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        (menuRef.current?.contains(event.target) ||
          boundaryRef?.current?.contains(event.target))
      ) {
        return;
      }

      onClose();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [boundaryRef, onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={messages.appMenu.label}
      className="gv-app-menu gv-popover absolute top-[calc(100%+0.5rem)] left-0 z-[100] flex w-72 flex-col gap-1 p-1.5"
    >
      <AppMenuLink href={APP_REPOSITORY_URL} label={messages.appMenu.github}>
        <GitHubLogo className="size-4" />
      </AppMenuLink>
      <AppMenuLink href={APP_ISSUES_URL} label={messages.appMenu.reportIssue}>
        <CircleDot className="size-4" />
      </AppMenuLink>
      <AppMenuLink
        href={shareUrl}
        label={messages.appMenu.shareOnX}
        trailingIcon={<Share2 className="size-3.5 text-[var(--text-mute)]" />}
      >
        <XLogo className="size-4" />
      </AppMenuLink>
    </div>
  );
}

function AppMenuLink({
  children,
  href,
  label,
  trailingIcon,
}: {
  children: ReactNode;
  href: string;
  label: string;
  trailingIcon?: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      role="menuitem"
      className="grid min-w-0 grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2 rounded-[var(--app-radius-md)] px-2 py-1.5 text-[var(--text-dim)] transition-colors hover:bg-[var(--state-hover-bg)] hover:text-[var(--state-hover-text)] focus-visible:ring-2 focus-visible:ring-[var(--state-focus-ring)] focus-visible:outline-none"
    >
      <span className="grid size-7 place-items-center rounded-[var(--app-radius-sm)] bg-[var(--state-control-bg)]">
        {children}
      </span>
      <span className="block min-w-0 truncate text-[length:var(--app-text-xs)] leading-none font-bold">
        {label}
      </span>
      {trailingIcon ?? (
        <ExternalLink className="size-3.5 text-[var(--text-mute)]" />
      )}
    </a>
  );
}

function createXShareUrl({ text, url }: { text: string; url: string }) {
  const params = new URLSearchParams({ text, url });

  return `https://twitter.com/intent/tweet?${params.toString()}`;
}
