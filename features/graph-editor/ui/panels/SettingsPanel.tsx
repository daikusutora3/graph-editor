"use client";

import { ArrowLeftRight, Trash2 } from "lucide-react";

import type { GraphModel, GraphSettings } from "../../core/graph/model";
import { useAtomValue } from "jotai";

import { useI18n } from "../../i18n/I18nProvider";
import { graphIsEmptyAtom } from "../../shell/state/graph-atoms";
import type { Locale } from "../../i18n/locale";
import {
  ActionRow,
  ControlGroup,
  ControlRow,
  Hairline,
  Segment,
  OptionToggle,
} from "@/components/ui/controls";

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
  const isGraphEmpty = useAtomValue(graphIsEmptyAtom);

  return (
    <>
      <ControlGroup>
        <ControlRow label={messages.settings.direction}>
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
        </ControlRow>
        <ControlRow label={messages.settings.weight}>
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
        </ControlRow>
        <ControlRow label={messages.settings.indexBase}>
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
        </ControlRow>
        {settings.directed ? (
          <>
            <ControlRow label={messages.settings.arrows}>
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
            </ControlRow>
            <ActionRow
              icon={
                <ArrowLeftRight className="size-icon-sm" aria-hidden="true" />
              }
              disabled={!canReverseAll}
              onClick={onReverseAllEdges}
            >
              {messages.settings.reverseAllEdges}
            </ActionRow>
          </>
        ) : null}
      </ControlGroup>

      <ControlGroup label={messages.chrome.display} spacing="tight">
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
      </ControlGroup>

      <ControlGroup label={messages.settings.language}>
        <Segment
          label={messages.settings.language}
          size={segmentSize}
          value={locale}
          options={localeOptions}
          onChange={(value) => setLocale(value as Locale)}
        />
      </ControlGroup>

      <div>
        <Hairline className="mb-1.5" />
        <ActionRow
          active={clearArmed}
          disabled={isGraphEmpty}
          icon={<Trash2 className="size-icon-sm" aria-hidden="true" />}
          tone="danger"
          aria-label={
            clearArmed ? messages.chrome.clearArmed : messages.chrome.clear
          }
          onClick={onClear}
          trailing={
            clearArmed
              ? messages.chrome.clearArmedHint
              : messages.chrome.clearHint
          }
        >
          {clearArmed ? messages.chrome.clearArmed : messages.chrome.clear}
        </ActionRow>
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
