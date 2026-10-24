"use client";

import { Plus } from "lucide-react";
import { useId, useState } from "react";

import { Button, focusRing } from "@/components/ui/controls";
import { cn } from "@/lib/utils";
import type { GraphNode } from "../../core/graph/model";
import { useI18n } from "../../i18n/I18nProvider";
import { nodeCreationCopy } from "../../i18n/node-creation-copy";

export function NodeCreationAction({
  mobile,
  onAddNode,
}: {
  mobile: boolean;
  onAddNode: (actionHeight: number) => GraphNode | null;
}) {
  const { locale } = useI18n();
  const copy = nodeCreationCopy[locale];
  const descriptionId = useId();
  const statusId = `${descriptionId}-status`;
  const [addedNode, setAddedNode] = useState<GraphNode | null>(null);
  const [failed, setFailed] = useState(false);

  return (
    <div
      data-editor-chrome-control="true"
      data-node-creation-action
      className={cn(
        "pointer-events-auto absolute z-40 flex min-h-0 max-w-[calc(100%-5.25rem)] flex-col gap-[4px]",
        mobile
          ? cn(
              "left-3",
              failed
                ? "bottom-[calc(var(--ge-mobile-controls-bottom,92px)-6px)]"
                : "bottom-[var(--ge-mobile-controls-bottom,92px)]",
            )
          : "bottom-6 left-6",
      )}
      style={
        failed
          ? {
              maxHeight: mobile
                ? "calc(100% - var(--ge-top-chrome-bottom,64px) - var(--ge-mobile-controls-bottom,92px))"
                : "calc(100% - var(--ge-top-chrome-bottom,68px) - 1.5rem - 6px)",
            }
          : undefined
      }
    >
      <Button
        variant="secondary"
        wrap
        aria-describedby={
          failed ? `${descriptionId} ${statusId}` : descriptionId
        }
        data-graph-shortcut-target="true"
        className="ge-panel min-h-11 max-w-full rounded-xl px-3.5 backdrop-blur-[16px]"
        style={{ paddingBlock: ".25rem" }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ")
            event.stopPropagation();
        }}
        onClick={(event) => {
          const node = onAddNode(
            event.currentTarget.getBoundingClientRect().height,
          );
          setFailed(!node);
          if (node) setAddedNode(node);
        }}
      >
        <Plus className="size-4 shrink-0" aria-hidden="true" />
        {copy.add}
      </Button>
      <span id={descriptionId} className="sr-only">
        {copy.description}
      </span>
      <span
        id={statusId}
        data-node-creation-feedback
        role="status"
        aria-live="polite"
        tabIndex={failed ? 0 : undefined}
        onKeyDown={(event) => event.stopPropagation()}
        className={
          failed
            ? cn(
                focusRing,
                "ge-scrollbar order-first min-h-0 shrink overflow-y-auto overscroll-contain rounded-lg border border-[var(--line)] bg-[var(--panel-solid)] px-3 text-xs leading-tight text-[var(--text)]",
              )
            : "sr-only"
        }
      >
        {failed ? (
          copy.unavailable
        ) : addedNode ? (
          <span key={addedNode.id}>{copy.added(addedNode.label)}</span>
        ) : null}
      </span>
    </div>
  );
}
