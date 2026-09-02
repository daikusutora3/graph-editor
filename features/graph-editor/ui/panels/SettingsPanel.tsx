"use client";

import { ArrowLeftRight, CircleDot, Share2, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

import { getAppLocaleUrl } from "@/lib/site-metadata";
import { cn } from "@/lib/utils";

import type { GraphModel, GraphSettings } from "../../core/graph/model";
import { useI18n } from "../../i18n/I18nProvider";
import type { Locale } from "../../i18n/locale";
import { GitHubLogo, XLogo } from "../brand/social-logos";
import {
  Button,
  Hairline,
  SectionLabel,
  Segment,
  SwitchRow,
  focusRing,
} from "../primitives";

const APP_REPOSITORY_URL = "https://github.com/daikusutora3/graph-editor";
const APP_ISSUES_URL = `${APP_REPOSITORY_URL}/issues/new`;

export function SettingsPanel({
  clearArmed,
  graph,
  mobile,
  onClear,
  onReverseAllEdges,
  onUpdateSettings,
}: {
  clearArmed: boolean;
  graph: GraphModel;
  mobile: boolean;
  onClear: () => void;
  onReverseAllEdges: () => void;
  onUpdateSettings: (patch: Partial<GraphSettings>) => void;
}) {
  const { locale, localeOptions, messages, setLocale } = useI18n();
  const { settings } = graph;
  const segmentSize = mobile ? "md" : "sm";
  const canReverseAll =
    settings.directed &&
    graph.edges.some((edge) => edge.source !== edge.target);
  const isGraphEmpty = graph.nodes.length === 0 && graph.edges.length === 0;
  const shareUrl = createXShareUrl({
    text: `${messages.app.title} - ${messages.app.description}`,
    url: getAppLocaleUrl(locale),
  });

  return (
    <>
      <div className="flex flex-col gap-2">
        <SectionLabel>{messages.chrome.graphType}</SectionLabel>
        <Segment
          label={messages.settings.direction}
          size={segmentSize}
          value={settings.directed ? "directed" : "undirected"}
          options={[
            { label: messages.settings.undirected, value: "undirected" },
            { label: messages.settings.directed, value: "directed" },
          ]}
          onChange={(value) =>
            onUpdateSettings({ directed: value === "directed" })
          }
        />
        <Segment
          label={messages.settings.weight}
          size={segmentSize}
          value={settings.weighted ? "weighted" : "unweighted"}
          options={[
            { label: messages.settings.unweighted, value: "unweighted" },
            { label: messages.settings.weighted, value: "weighted" },
          ]}
          onChange={(value) =>
            onUpdateSettings({ weighted: value === "weighted" })
          }
        />
        <Segment
          label={messages.settings.indexBase}
          size={segmentSize}
          value={String(settings.indexBase)}
          options={[
            { label: "0-indexed", value: "0" },
            { label: "1-indexed", value: "1" },
          ]}
          onChange={(value) =>
            onUpdateSettings({
              indexBase: Number(value) as GraphSettings["indexBase"],
            })
          }
        />
        {settings.directed ? (
          <>
            <Segment
              label={messages.settings.arrowSize}
              size={segmentSize}
              value={arrowScaleToSettingValue(settings.arrowScale)}
              options={[
                { label: messages.settings.arrowSmall, value: "small" },
                { label: messages.settings.arrowNormal, value: "normal" },
                { label: messages.settings.arrowLarge, value: "large" },
              ]}
              onChange={(value) =>
                onUpdateSettings({
                  arrowScale: arrowScaleFromSettingValue(value),
                })
              }
            />
            <Button
              className="justify-start rounded-lg px-3 text-[13px]"
              disabled={!canReverseAll}
              onClick={onReverseAllEdges}
            >
              <ArrowLeftRight className="size-[15px]" aria-hidden="true" />
              {messages.settings.reverseAllEdges}
            </Button>
          </>
        ) : null}
      </div>

      <div className="flex flex-col gap-0.5">
        <SectionLabel className="pb-1.5">
          {messages.chrome.display}
        </SectionLabel>
        <SwitchRow
          checked={settings.snapToGrid}
          label={messages.settings.snapToGrid}
          onClick={() => onUpdateSettings({ snapToGrid: !settings.snapToGrid })}
        />
        <SwitchRow
          checked={settings.showNodeLabels}
          label={messages.settings.showNodeLabels}
          onClick={() =>
            onUpdateSettings({ showNodeLabels: !settings.showNodeLabels })
          }
        />
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel>{messages.settings.language}</SectionLabel>
        <Segment
          label={messages.settings.language}
          size={segmentSize}
          value={locale}
          options={localeOptions}
          onChange={(value) => setLocale(value as Locale)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel>{messages.chrome.links}</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          <LinkChip href={APP_REPOSITORY_URL} label={messages.appMenu.github}>
            <GitHubLogo className="size-3.5" aria-hidden="true" />
          </LinkChip>
          <LinkChip href={APP_ISSUES_URL} label={messages.appMenu.reportIssue}>
            <CircleDot className="size-3.5" aria-hidden="true" />
          </LinkChip>
          <LinkChip href={shareUrl} label={messages.appMenu.shareOnX}>
            <XLogo className="size-3.5" aria-hidden="true" />
            <Share2 className="size-3 text-[var(--faint)]" aria-hidden="true" />
          </LinkChip>
        </div>
      </div>

      <div className="pt-1.5">
        <Hairline className="mb-1.5" />
        <button
          type="button"
          disabled={isGraphEmpty}
          aria-label={
            clearArmed ? messages.chrome.clearArmed : messages.chrome.clear
          }
          onClick={onClear}
          className={cn(
            "flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-[13px] font-semibold transition-colors disabled:cursor-default disabled:text-[var(--disabled)] disabled:hover:bg-transparent",
            focusRing,
            clearArmed
              ? "bg-[var(--danger-fill)] text-[var(--danger)]"
              : "text-[var(--muted)] hover:bg-[var(--danger-fill)] hover:text-[var(--danger)]",
          )}
        >
          <Trash2 className="size-[15px]" aria-hidden="true" />
          <span className="flex-1">
            {clearArmed ? messages.chrome.clearArmed : messages.chrome.clear}
          </span>
          <span className="text-[11px] text-[var(--faint)]">
            {clearArmed
              ? messages.chrome.clearArmedHint
              : messages.chrome.clearHint}
          </span>
        </button>
      </div>
    </>
  );
}

function LinkChip({
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
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--fill)] px-2.5 text-xs font-semibold text-[var(--text-2)] transition-colors hover:bg-[var(--fill-2)] hover:text-[var(--text)]",
        focusRing,
      )}
    >
      {children}
      {label}
    </a>
  );
}

function arrowScaleToSettingValue(value: number) {
  if (value <= 0.75) {
    return "small";
  }

  if (value >= 1.4) {
    return "large";
  }

  return "normal";
}

function arrowScaleFromSettingValue(value: string) {
  switch (value) {
    case "small":
      return 0.7;
    case "large":
      return 1.5;
    default:
      return 1;
  }
}

function createXShareUrl({ text, url }: { text: string; url: string }) {
  const params = new URLSearchParams({ text, url });

  return `https://twitter.com/intent/tweet?${params.toString()}`;
}
