"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { ArrowLeftRight } from "lucide-react";

import type { GraphSettings } from "../core/graph/model";
import { useI18n } from "../i18n/I18nProvider";
import type { Locale } from "../i18n/locale";
import {
  reverseAllDirectedEdgesAtom,
  updateGraphSettingsAtom,
} from "../shell/state/editor-actions";
import { graphAtom } from "../shell/state/graph-atoms";
import { SelectControl } from "./SelectControl";

export function GraphSettingsControl({
  onSettingsChange,
}: {
  onSettingsChange?: () => void;
}) {
  const graph = useAtomValue(graphAtom);
  const reverseAllDirectedEdges = useSetAtom(reverseAllDirectedEdgesAtom);
  const updateGraphSettings = useSetAtom(updateGraphSettingsAtom);
  const { locale, localeOptions, messages, setLocale } = useI18n();
  const { settings } = graph;
  const canReverseAll =
    settings.directed &&
    graph.edges.some((edge) => edge.source !== edge.target);
  const updateSettings = (patch: Partial<GraphSettings>) => {
    updateGraphSettings(patch);
    onSettingsChange?.();
    settleToolbarAfterSettingChange();
  };

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <SettingSegment
        label={messages.settings.direction}
        value={settings.directed ? "directed" : "undirected"}
        onChange={(value) => updateSettings({ directed: value === "directed" })}
        options={[
          { label: messages.settings.undirected, value: "undirected" },
          { label: messages.settings.directed, value: "directed" },
        ]}
      />
      <button
        type="button"
        className="gv-control h-8 justify-center px-[var(--app-space-3)] text-[length:var(--app-text-xs)]"
        disabled={!canReverseAll}
        aria-label={messages.settings.reverseAllEdges}
        title={messages.settings.reverseAllEdges}
        onClick={() => reverseAllDirectedEdges()}
      >
        <ArrowLeftRight className="size-4" aria-hidden="true" />
        <span className="truncate">{messages.settings.reverseAllEdges}</span>
      </button>
      <SettingSegment
        label={messages.settings.weight}
        value={settings.weighted ? "weighted" : "unweighted"}
        onChange={(value) => updateSettings({ weighted: value === "weighted" })}
        options={[
          { label: messages.settings.unweighted, value: "unweighted" },
          { label: messages.settings.weighted, value: "weighted" },
        ]}
      />
      <SettingSegment
        label={messages.settings.indexBase}
        value={String(settings.indexBase)}
        onChange={(value) =>
          updateSettings({
            indexBase: Number(value) as GraphSettings["indexBase"],
          })
        }
        options={[
          { label: "0-indexed", value: "0" },
          { label: "1-indexed", value: "1" },
        ]}
      />
      <SettingSegment
        label={messages.settings.arrowSize}
        value={arrowScaleToSettingValue(settings.arrowScale)}
        onChange={(value) =>
          updateSettings({ arrowScale: arrowScaleFromSettingValue(value) })
        }
        options={[
          { label: messages.settings.arrowSmall, value: "small" },
          { label: messages.settings.arrowNormal, value: "normal" },
          { label: messages.settings.arrowLarge, value: "large" },
        ]}
      />
      <SettingCheckbox
        label={messages.settings.snapToGrid}
        checked={settings.snapToGrid}
        onChange={(checked) => updateSettings({ snapToGrid: checked })}
      />
      <SettingSelect
        label={messages.settings.language}
        value={locale}
        onChange={(value) => {
          setLocale(value as Locale);
          onSettingsChange?.();
          settleToolbarAfterSettingChange();
        }}
        options={localeOptions}
      />
    </div>
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

function settleToolbarAfterSettingChange() {
  const scroller = document.querySelector<HTMLElement>(
    ".gv-left-sidebar .gv-scrollbar",
  );
  const sidebar = document.querySelector<HTMLElement>(".gv-left-sidebar");
  const scrollerPosition = scroller
    ? { left: scroller.scrollLeft, top: scroller.scrollTop }
    : null;
  const sidebarPosition = sidebar
    ? { left: sidebar.scrollLeft, top: sidebar.scrollTop }
    : null;
  const windowPosition = { left: window.scrollX, top: window.scrollY };

  const restoreScroll = () => {
    if (sidebar && sidebarPosition) {
      sidebar.scrollTop = sidebarPosition.top;
      sidebar.scrollLeft = sidebarPosition.left;
    }
    scroller?.scrollTo(scrollerPosition ?? { left: 0, top: 0 });
    window.scrollTo(windowPosition);
  };

  window.requestAnimationFrame(restoreScroll);
  window.setTimeout(restoreScroll, 0);
  window.setTimeout(restoreScroll, 80);
}

function SettingCheckbox({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="gv-control h-8 cursor-pointer justify-start px-[var(--app-space-3)] text-[length:var(--app-text-xs)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
        className="size-4 accent-[var(--accent-1)]"
      />
      <span className="truncate">{label}</span>
    </label>
  );
}

function SettingSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { label: string; value: string }[];
}) {
  return (
    <label className="block min-w-0">
      <SelectControl
        name="graph-language"
        value={value}
        aria-label={label}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectControl>
    </label>
  );
}

function SettingSegment({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { label: string; value: string }[];
}) {
  return (
    <div className="min-w-0">
      <div className="gv-segment" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const selected = option.value === value;
          const applyOption = () => {
            if (selected) {
              settleToolbarAfterSettingChange();
              return;
            }

            onChange(option.value);
          };

          return (
            <label
              key={option.value}
              className="gv-segment-button"
              onClick={(event) => {
                event.preventDefault();
                applyOption();
              }}
            >
              <input
                className="sr-only"
                type="radio"
                name={`graph-setting-${label}`}
                value={option.value}
                checked={selected}
                aria-label={`${label}: ${option.label}`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  applyOption();
                }}
                onChange={() => onChange(option.value)}
              />
              <span className="block truncate">{option.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
