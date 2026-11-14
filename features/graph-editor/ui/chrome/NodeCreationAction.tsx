"use client";

import { Plus } from "lucide-react";
import { useId, useState } from "react";

import { Button, focusRing } from "@/components/ui/controls";
import { cn } from "@/lib/utils";
import type { GraphNode } from "../../core/graph/model";
import { useI18n } from "../../i18n/I18nProvider";
import { nodeCreationCopy } from "../../i18n/node-creation-copy";
import { surface } from "@/components/ui/surfaces";

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
  // Pointer and touch users add vertices on the canvas, so this keyboard and
  // screen-reader path stays invisible until it receives focus (like a skip
  // link). It also stays visible while its "no room" message is shown.
  const [focused, setFocused] = useState(false);
  const visible = focused || failed;

  return (
    <div
      data-editor-chrome-control="true"
      data-node-creation-action
      data-visible={visible ? "" : undefined}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocused(false);
        }
      }}
      className={cn(
        "absolute z-40 flex min-h-0 max-w-[calc(100%-5.25rem)] flex-col gap-[4px] transition-opacity motion-reduce:transition-none",
        visible
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none opacity-0",
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
        className="ge-panel min-h-11 max-w-full rounded-xl px-3.5"
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
                surface.floating,
                "ge-scrollbar order-first min-h-0 shrink overflow-y-auto overscroll-contain rounded-lg px-3 text-xs leading-tight text-[var(--text)]",
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
