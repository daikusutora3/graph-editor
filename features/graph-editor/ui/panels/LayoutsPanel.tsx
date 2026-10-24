"use client";

import { GitCompareArrows } from "lucide-react";
import { useId, useMemo } from "react";

import {
  ChoiceButton,
  OptionToggle,
  ControlGroup,
} from "@/components/ui/controls";

import type { GraphModel } from "../../core/graph/model";
import { useI18n } from "../../i18n/I18nProvider";
import {
  manualLayoutDisabledReasonCode,
  type LayoutDisabledReason,
  type LayoutKind,
} from "../../layouts";

export const layoutPanelOrder: readonly LayoutKind[] = [
  "force",
  "bfs",
  "spread",
  "tree",
  "dagLayer",
  "bipartite",
  "scc",
  "radial",
  "circle",
  "grid",
  "line",
  "concentric",
];

export function LayoutsPanel({
  graph,
  pending = false,
  showTitle = false,
  onApplyLayout,
  onToggleOffsetEdges,
}: {
  graph: GraphModel;
  pending?: boolean;

  showTitle?: boolean;
  onApplyLayout: (kind: LayoutKind) => void;
  onToggleOffsetEdges: () => void;
}) {
  const { messages } = useI18n();
  const reasonsId = useId();
  const disabledReasons = useMemo(
    () =>
      new Map(
        layoutPanelOrder.map((kind) => [
          kind,
          manualLayoutDisabledReasonCode(kind, graph),
        ]),
      ),
    [graph],
  );
  const disabledReasonGroups = useMemo(() => {
    const groups = new Map<LayoutDisabledReason, LayoutKind[]>();
    for (const kind of layoutPanelOrder) {
      const reason = disabledReasons.get(kind);
      if (reason) groups.set(reason, [...(groups.get(reason) ?? []), kind]);
    }
    return [...groups];
  }, [disabledReasons]);
  return (
    <ControlGroup label={showTitle ? messages.chrome.layouts : undefined}>
      <div className="grid grid-cols-3 gap-1.5">
        {layoutPanelOrder.map((kind, index) => {
          const reason = disabledReasons.get(kind) ?? null;
          const layout = messages.layouts[kind];

          return (
            <ChoiceButton
              key={kind}
              aria-label={`${layout.label}: ${layout.subtitle}`}
              aria-disabled={reason ? true : undefined}
              aria-describedby={reason ? `${reasonsId}-${reason}` : undefined}
              variant={reason ? "disabled" : "choice"}
              data-tooltip={reason ? undefined : layout.tooltip}
              data-tooltip-side={
                index % 3 === 0
                  ? "bottom-start"
                  : index % 3 === 2
                    ? "bottom-end"
                    : undefined
              }
              onClick={() => {
                if (!reason) {
                  onApplyLayout(kind);
                }
              }}
            >
              {layout.label}
            </ChoiceButton>
          );
        })}
      </div>
      {disabledReasonGroups.length > 0 ? (
        <ul className="flex flex-col gap-1 text-xs leading-relaxed text-[var(--muted)]">
          {disabledReasonGroups.map(([reason, kinds]) => (
            <li key={reason} id={`${reasonsId}-${reason}`}>
              {kinds.length < layoutPanelOrder.length ? (
                <span className="font-semibold">
                  {kinds
                    .map((kind) => messages.layouts[kind].label)
                    .join(" / ")}
                  {": "}
                </span>
              ) : null}
              {messages.layouts.disabled[reason]}
            </li>
          ))}
        </ul>
      ) : null}
      {pending ? (
        <p
          role="status"
          aria-live="polite"
          className="text-control text-[var(--muted)]"
        >
          {messages.chrome.layoutPending}
        </p>
      ) : null}
      <OptionToggle
        checked={graph.settings.autoEdgeRouting}
        icon={<GitCompareArrows className="size-icon-sm" aria-hidden="true" />}
        label={messages.chrome.offsetEdges}
        onChange={() => onToggleOffsetEdges()}
      />
    </ControlGroup>
  );
}
