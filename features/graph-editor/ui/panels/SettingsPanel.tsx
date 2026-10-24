"use client";

import { ArrowLeftRight, Trash2 } from "lucide-react";
import { useId, useLayoutEffect, useRef } from "react";

import type { GraphModel, GraphSettings } from "../../core/graph/model";
import { useAtomValue } from "jotai";

import { useI18n } from "../../i18n/I18nProvider";
import { clearConfirmationCopy } from "../../i18n/clear-confirmation-copy";
import { graphIsEmptyAtom } from "../../shell/state/graph-atoms";
import type { Locale } from "../../i18n/locale";
import {
  ActionRow,
  Button,
  ControlGroup,
  ControlRow,
  Hairline,
  Segment,
  OptionToggle,
  PanelActions,
} from "@/components/ui/controls";

export function SettingsPanel({
  clearArmed,
  graph,
  mobile,
  onCancelClear,
  onClear,
  onReverseAllEdges,
  onUpdateSettings,
}: {
  clearArmed: boolean;
  graph: GraphModel;
  mobile: boolean;
  onCancelClear: () => void;
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

      <ClearGraphControl
        clearArmed={clearArmed}
        isGraphEmpty={isGraphEmpty}
        onCancelClear={onCancelClear}
        onClear={onClear}
      />
    </>
  );
}

export function ClearGraphControl({
  clearArmed,
  isGraphEmpty,
  onCancelClear,
  onClear,
}: {
  clearArmed: boolean;
  isGraphEmpty: boolean;
  onCancelClear: () => void;
  onClear: () => void;
}) {
  const { locale, messages } = useI18n();
  const copy = clearConfirmationCopy[locale];
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const restoreTriggerRef = useRef(false);

  useLayoutEffect(() => {
    if (clearArmed) {
      rootRef.current
        ?.querySelector<HTMLButtonElement>("[data-clear-cancel]")
        ?.focus();
    } else if (restoreTriggerRef.current) {
      rootRef.current
        ?.querySelector<HTMLButtonElement>("[data-clear-trigger]")
        ?.focus({ preventScroll: true });
    }
    restoreTriggerRef.current = false;
  }, [clearArmed]);

  return (
    <div ref={rootRef}>
      <Hairline className="mb-1.5" />
      {clearArmed ? (
        <div
          data-clear-confirmation
          role="group"
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-description`}
          className="flex flex-col gap-3 rounded-lg border border-[var(--line)] bg-[var(--bg)] p-3"
        >
          <div className="flex flex-col gap-1">
            <h3
              id={`${id}-title`}
              className="text-control font-semibold text-[var(--text)]"
            >
              {copy.title}
            </h3>
            <p
              id={`${id}-description`}
              className="text-xs leading-relaxed text-[var(--text-2)]"
            >
              {copy.description}
            </p>
          </div>
          <PanelActions>
            <Button
              data-clear-cancel
              aria-describedby={`${id}-description`}
              variant="secondary"
              size="lg"
              wrap
              onClick={() => {
                restoreTriggerRef.current = true;
                onCancelClear();
              }}
            >
              {copy.cancel}
            </Button>
            <Button
              data-clear-confirm
              aria-describedby={`${id}-description`}
              disabled={isGraphEmpty}
              variant="danger"
              size="lg"
              wrap
              onClick={onClear}
            >
              <Trash2 className="size-icon-sm" aria-hidden="true" />
              {copy.confirm}
            </Button>
          </PanelActions>
        </div>
      ) : (
        <ActionRow
          data-clear-trigger
          disabled={isGraphEmpty}
          icon={<Trash2 className="size-icon-sm" aria-hidden="true" />}
          tone="danger"
          onClick={onClear}
        >
          {messages.chrome.clear}
        </ActionRow>
      )}
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
