"use client";

import {
  ArrowUpRight,
  BookOpen,
  CircleDot,
  Keyboard,
  Newspaper,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  appArticlePaths,
  appGuidePaths,
  getAppLocaleUrl,
} from "@/lib/site-metadata";
import { contentNavigationCopy } from "@/lib/content-navigation";

import { useI18n } from "../../i18n/I18nProvider";
import { GitHubLogo, XLogo } from "../brand/social-logos";
import { ActionRow, Hairline, Kbd } from "@/components/ui/controls";
import { menuFocusKeyDown } from "../primitives/focus-navigation";

const APP_REPOSITORY_URL = "https://github.com/daikusutora3/graph-editor";
const APP_ISSUES_URL = `${APP_REPOSITORY_URL}/issues/new`;

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
    <div
      className="-mx-2 -my-1 flex flex-col gap-0.5"
      role="menu"
      onKeyDown={menuFocusKeyDown}
    >
      <MenuLink href={appGuidePaths[locale]} label={messages.appMenu.guide}>
        <BookOpen className="size-4" aria-hidden="true" />
      </MenuLink>
      <MenuLink
        href={appArticlePaths[locale]}
        label={contentNavigationCopy[locale].articles}
      >
        <Newspaper className="size-4" aria-hidden="true" />
      </MenuLink>
      <ActionRow
        role="menuitem"
        density="menu"
        icon={
          <Keyboard className="size-4 text-[var(--muted)]" aria-hidden="true" />
        }
        trailing={<Kbd>?</Kbd>}
        onClick={onOpenShortcuts}
      >
        {messages.chrome.shortcuts}
      </ActionRow>
      <Hairline className="my-1" />
      <MenuLink href={APP_REPOSITORY_URL} label={messages.appMenu.github}>
        <GitHubLogo className="size-4" aria-hidden="true" />
      </MenuLink>
      <MenuLink href={APP_ISSUES_URL} label={messages.appMenu.reportIssue}>
        <CircleDot className="size-4" aria-hidden="true" />
      </MenuLink>
      <MenuLink href={shareUrl} label={messages.appMenu.shareOnX}>
        <XLogo className="size-4" aria-hidden="true" />
      </MenuLink>
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
    <ActionRow
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      role="menuitem"
      density="menu"
      icon={<span className="text-[var(--muted)]">{children}</span>}
      trailing={<ArrowUpRight className="size-3.5" aria-hidden="true" />}
    >
      {label}
    </ActionRow>
  );
}

function createXShareUrl({ text, url }: { text: string; url: string }) {
  const params = new URLSearchParams({ text, url });

  return `https://twitter.com/intent/tweet?${params.toString()}`;
}
