"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { ChevronDown } from "lucide-react";

import type { GraphSettings } from "../core/graph/model";
import { useI18n } from "../i18n/I18nProvider";
import type { Locale } from "../i18n/locale";
import { updateGraphSettingsAtom } from "../shell/state/editor-actions";
import { graphAtom } from "../shell/state/graph-atoms";

export function GraphSettingsControl() {
  const graph = useAtomValue(graphAtom);
  const updateGraphSettings = useSetAtom(updateGraphSettingsAtom);
  const { locale, localeOptions, messages, setLocale } = useI18n();
  const { settings } = graph;
  const updateSettings = (patch: Partial<GraphSettings>) => {
    updateGraphSettings(patch);
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
      <SettingSelect
        label={messages.settings.language}
        value={locale}
        onChange={(value) => setLocale(value as Locale)}
        options={localeOptions}
      />
    </div>
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
      <span className="relative block min-w-0">
        <select
          name="graph-language"
          value={value}
          aria-label={label}
          autoComplete="off"
          onChange={(event) => onChange(event.target.value)}
          className="gv-select-control"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-[var(--text-mute)]"
          aria-hidden="true"
          strokeWidth={2}
        />
      </span>
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

          return (
            <label key={option.value} className="gv-segment-button">
              <input
                className="sr-only"
                type="radio"
                name={`graph-setting-${label}`}
                value={option.value}
                checked={selected}
                aria-label={`${label}: ${option.label}`}
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
