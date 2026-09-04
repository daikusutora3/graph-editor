"use client";

import { ArrowLeftRight, Lightbulb, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";

import type { GraphModel, GraphSettings } from "../../core/graph/model";
import { useAtomValue } from "jotai";

import { useI18n } from "../../i18n/I18nProvider";
import { graphIsEmptyAtom } from "../../shell/state/graph-atoms";
import type { Locale } from "../../i18n/locale";
import {
  Button,
  Hairline,
  SectionLabel,
  Segment,
  OptionToggle,
  focusRing,
} from "../primitives";

export function SettingsPanel({
  clearArmed,
  graph,
  mobile,
  onClear,
  onResetHints,
  onReverseAllEdges,
  onUpdateSettings,
}: {
  clearArmed: boolean;
  graph: GraphModel;
  mobile: boolean;
  onClear: () => void;
  onResetHints: () => void;
  onReverseAllEdges: () => void;
  onUpdateSettings: (patch: Partial<GraphSettings>) => void;
}) {
  const { locale, localeOptions, messages, setLocale } = useI18n();
  const { settings } = graph;
  const segmentSize = mobile ? "md" : "sm";
  const canReverseAll =
    settings.directed &&
    graph.edges.some((edge) => edge.source !== edge.target);
  const isGraphEmpty = useAtomValue(graphIsEmptyAtom);

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
              className="text-control justify-start rounded-lg px-3"
              disabled={!canReverseAll}
              onClick={onReverseAllEdges}
            >
              <ArrowLeftRight className="size-icon-sm" aria-hidden="true" />
              {messages.settings.reverseAllEdges}
            </Button>
          </>
        ) : null}
      </div>

      <div className="flex flex-col gap-0.5">
        <SectionLabel className="pb-1.5">
          {messages.chrome.display}
        </SectionLabel>
        <OptionToggle
          checked={settings.snapToGrid}
          label={messages.settings.snapToGrid}
          onChange={(checked) => onUpdateSettings({ snapToGrid: checked })}
        />
        <OptionToggle
          checked={settings.showNodeLabels}
          label={messages.settings.showNodeLabels}
          onChange={(checked) => onUpdateSettings({ showNodeLabels: checked })}
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

      <div className="pt-1.5">
        <Hairline className="mb-1.5" />
        <button
          type="button"
          onClick={onResetHints}
          className={cn(
            "touch:min-h-11 text-control flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left font-semibold text-[var(--muted)] transition-colors hover:bg-[var(--fill)] hover:text-[var(--text)]",
            focusRing,
          )}
        >
          <Lightbulb className="size-icon-sm" aria-hidden="true" />
          <span className="flex-1">{messages.chrome.resetHints}</span>
        </button>
        <button
          type="button"
          disabled={isGraphEmpty}
          aria-label={
            clearArmed ? messages.chrome.clearArmed : messages.chrome.clear
          }
          onClick={onClear}
          className={cn(
            "touch:min-h-11 text-control flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left font-semibold transition-colors disabled:cursor-default disabled:text-[var(--faint)] disabled:hover:bg-transparent",
            focusRing,
            clearArmed
              ? "bg-[var(--danger-fill)] text-[var(--danger)]"
              : "text-[var(--muted)] hover:bg-[var(--danger-fill)] hover:text-[var(--danger)]",
          )}
        >
          <Trash2 className="size-icon-sm" aria-hidden="true" />
          <span className="flex-1">
            {clearArmed ? messages.chrome.clearArmed : messages.chrome.clear}
          </span>
          <span className="text-meta font-medium text-[var(--muted)]">
            {clearArmed
              ? messages.chrome.clearArmedHint
              : messages.chrome.clearHint}
          </span>
        </button>
      </div>
    </>
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
