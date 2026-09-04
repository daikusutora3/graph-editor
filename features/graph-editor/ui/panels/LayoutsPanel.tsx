"use client";

import { GitCompareArrows } from "lucide-react";
import { useMemo } from "react";

import { cn } from "@/lib/utils";

import type { GraphModel } from "../../core/graph/model";
import { useI18n } from "../../i18n/I18nProvider";
import { manualLayoutDisabledReasonCode, type LayoutKind } from "../../layouts";
import {
  SectionLabel,
  OptionToggle,
  disabledControl,
  focusRing,
  raisedControl,
} from "../primitives";

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
  showTitle = false,
  onApplyLayout,
  onToggleOffsetEdges,
}: {
  graph: GraphModel;
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
    <div className="flex flex-col gap-2.5">
      {showTitle ? (
        <SectionLabel>{messages.chrome.layouts}</SectionLabel>
      ) : null}
      <div className="grid grid-cols-3 gap-1.5">
        {layoutPanelOrder.map((kind) => {
          const reason = disabledReasons.get(kind) ?? null;
          const layout = messages.layouts[kind];

          return (
            <button
              key={kind}
              type="button"
              aria-label={`${layout.label}: ${layout.subtitle}`}
              aria-disabled={reason ? true : undefined}
              data-tooltip={
                reason ? messages.layouts.disabled[reason] : layout.tooltip
              }
              onClick={() => {
                if (!reason) {
                  onApplyLayout(kind);
                }
              }}
              className={cn(
                "touch:h-11 text-control h-10 truncate rounded-lg px-2 font-semibold transition-colors",
                focusRing,
                reason ? disabledControl : raisedControl,
              )}
            >
              {layout.label}
            </button>
          );
        })}
      </div>
      <OptionToggle
        checked={graph.settings.autoEdgeRouting}
        icon={<GitCompareArrows className="size-icon-sm" aria-hidden="true" />}
        label={messages.chrome.offsetEdges}
        onChange={() => onToggleOffsetEdges()}
      />
    </div>
  );
}
