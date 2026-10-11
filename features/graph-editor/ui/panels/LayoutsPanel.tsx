"use client";

import { GitCompareArrows } from "lucide-react";
import { useMemo } from "react";

import {
  ChoiceButton,
  OptionToggle,
  ControlGroup,
} from "@/components/ui/controls";

import type { GraphModel } from "../../core/graph/model";
import { useI18n } from "../../i18n/I18nProvider";
import { manualLayoutDisabledReasonCode, type LayoutKind } from "../../layouts";

/** Order matches the design: primary strategies first, then geometric ones. */
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
  /** Show a section heading; used when the panel is stacked with others. */
  showTitle?: boolean;
  onApplyLayout: (kind: LayoutKind) => void;
  onToggleOffsetEdges: () => void;
}) {
  const { messages } = useI18n();
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
              variant={reason ? "disabled" : "choice"}
              data-tooltip={
                reason ? messages.layouts.disabled[reason] : layout.tooltip
              }
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
