"use client";

import { ArrowUpRight, CircleDot, Keyboard } from "lucide-react";
import type { ReactNode } from "react";

import { getAppLocaleUrl } from "@/lib/site-metadata";
import { cn } from "@/lib/utils";

import { useI18n } from "../../i18n/I18nProvider";
import { GitHubLogo, XLogo } from "../brand/social-logos";
import { Kbd, focusRing } from "../primitives";

const APP_REPOSITORY_URL = "https://github.com/daikusutora3/graph-editor";
const APP_ISSUES_URL = `${APP_REPOSITORY_URL}/issues/new`;

const rowClass = cn(
  "flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-control font-semibold text-[var(--text-2)] transition-colors hover:bg-[var(--fill)] hover:text-[var(--text)] touch:min-h-11",
  focusRing,
);

/** App menu behind the brand pill: project links and help. */
export function AppMenuPanel({
  onOpenShortcuts,
}: {
  onOpenShortcuts: () => void;
}) {
  const { locale, messages } = useI18n();
  const shareUrl = createXShareUrl({
    text: `${messages.app.title} - ${messages.app.description}`,
    url: getAppLocaleUrl(locale),
  });

  return (
    <div className="-mx-2 -my-1 flex flex-col gap-0.5" role="menu">
      <MenuLink href={APP_REPOSITORY_URL} label={messages.appMenu.github}>
        <GitHubLogo className="size-4" aria-hidden="true" />
      </MenuLink>
      <MenuLink href={APP_ISSUES_URL} label={messages.appMenu.reportIssue}>
        <CircleDot className="size-4" aria-hidden="true" />
      </MenuLink>
      <MenuLink href={shareUrl} label={messages.appMenu.shareOnX}>
        <XLogo className="size-4" aria-hidden="true" />
      </MenuLink>
      <div className="my-1 h-px bg-[var(--hair)]" aria-hidden="true" />
      <button
        type="button"
        role="menuitem"
        className={rowClass}
        onClick={onOpenShortcuts}
      >
        <span className="grid size-4 place-items-center text-[var(--muted)]">
          <Keyboard className="size-4" aria-hidden="true" />
        </span>
        <span className="flex-1">{messages.chrome.shortcuts}</span>
        <Kbd>?</Kbd>
      </button>
    </div>
  );
}

function MenuLink({
  children,
  href,
  label,
}: {
  children: ReactNode;
  href: string;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      role="menuitem"
      className={rowClass}
    >
      <span className="grid size-4 place-items-center text-[var(--muted)]">
        {children}
      </span>
      <span className="flex-1">{label}</span>
      <ArrowUpRight
        className="size-3.5 text-[var(--faint)]"
        aria-hidden="true"
      />
    </a>
  );
}

function createXShareUrl({ text, url }: { text: string; url: string }) {
  const params = new URLSearchParams({ text, url });

  return `https://twitter.com/intent/tweet?${params.toString()}`;
}
