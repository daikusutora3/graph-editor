"use client";

import { Plus } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/controls";
import { cn } from "@/lib/utils";
import type { GraphNode } from "../../core/graph/model";
import { useI18n } from "../../i18n/I18nProvider";
import { nodeCreationCopy } from "../../i18n/node-creation-copy";

/** A native action makes empty-canvas creation available without a pointer. */
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
  const [addedNode, setAddedNode] = useState<GraphNode | null>(null);
  const [failed, setFailed] = useState(false);

  return (
    <div
      data-editor-chrome-control="true"
      data-node-creation-action
      className={cn(
        "pointer-events-auto absolute z-40 max-w-[calc(100%-5.25rem)]",
        mobile
          ? "bottom-[var(--ge-mobile-controls-bottom,92px)] left-3"
          : "bottom-6 left-6",
      )}
    >
      <Button
        variant="secondary"
        wrap
        aria-describedby={descriptionId}
        data-graph-shortcut-target="true"
        className="ge-panel min-h-11 max-w-full rounded-xl px-3.5 backdrop-blur-[16px]"
        onKeyDown={(event) => {
          // Keep native button activation on Enter/Space, while allowing
          // editor shortcuts such as Undo when this action retains focus.
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
        role="status"
        aria-live="polite"
        className={
          failed
            ? "absolute inset-x-0 bottom-full mb-2 rounded-lg border border-[var(--line)] bg-[var(--panel-solid)] px-3 py-2 text-xs leading-relaxed text-[var(--text)]"
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
