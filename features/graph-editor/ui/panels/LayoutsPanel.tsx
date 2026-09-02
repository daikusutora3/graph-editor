"use client";

import { GitCompareArrows } from "lucide-react";
import { useMemo } from "react";

import { cn } from "@/lib/utils";

import type { GraphModel } from "../../core/graph/model";
import { useI18n } from "../../i18n/I18nProvider";
import { manualLayoutDisabledReasonCode, type LayoutKind } from "../../layouts";
import { SectionLabel, SwitchRow, focusRing } from "../primitives";

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
  onApplyLayout,
  onToggleOffsetEdges,
}: {
  graph: GraphModel;
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
      <SectionLabel trailing={messages.chrome.applyHint}>
        {messages.chrome.layouts}
      </SectionLabel>
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
              title={
                reason ? messages.layouts.disabled[reason] : layout.tooltip
              }
              onClick={() => {
                if (!reason) {
                  onApplyLayout(kind);
                }
              }}
              className={cn(
                "h-10 truncate rounded-lg bg-[var(--fill)] px-2 text-[13px] font-semibold transition-colors",
                focusRing,
                reason
                  ? "cursor-default text-[var(--disabled)]"
                  : "text-[var(--text)] hover:bg-[var(--fill-2)]",
              )}
            >
              {layout.label}
            </button>
          );
        })}
      </div>
      {!graph.settings.directed ? (
        <div className="text-[11.5px] text-[var(--faint)]">
          {messages.chrome.directedOnlyNote}
        </div>
      ) : null}
      <SwitchRow
        framed
        checked={graph.settings.autoEdgeRouting}
        icon={<GitCompareArrows className="size-[15px]" aria-hidden="true" />}
        label={messages.chrome.offsetEdges}
        onClick={onToggleOffsetEdges}
      />
    </div>
  );
}
