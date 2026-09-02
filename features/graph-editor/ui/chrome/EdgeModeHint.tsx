"use client";

import { useAtomValue } from "jotai";

import { useI18n } from "../../i18n/I18nProvider";
import { edgeDraftAtom, editorModeAtom } from "../../shell/state/editor-atoms";
import { graphAtom } from "../../shell/state/graph-atoms";

export function EdgeModeHint({
  mobile,
  visible,
}: {
  mobile: boolean;
  visible: boolean;
}) {
  const { messages } = useI18n();
  const mode = useAtomValue(editorModeAtom);
  const edgeDraft = useAtomValue(edgeDraftAtom);
  const graph = useAtomValue(graphAtom);

  if (!visible || mode !== "edge") {
    return null;
  }

  const sourceNode = edgeDraft.sourceNodeId
    ? graph.nodes.find((node) => node.id === edgeDraft.sourceNodeId)
    : null;
  const text = sourceNode
    ? messages.chrome.edgeHintTarget(sourceNode.label)
    : messages.chrome.edgeHintStart;

  return (
    <div
      className={[
        "pointer-events-none absolute inset-x-0 z-[60] flex justify-center",
        mobile ? "top-[68px]" : "top-[84px]",
      ].join(" ")}
    >
      <span
        role="status"
        aria-live="polite"
        className="ge-pop inline-flex h-[30px] items-center gap-2 rounded-full bg-[var(--primary)] px-3 text-xs font-semibold text-[var(--primary-text)] shadow-[var(--shadow)]"
      >
        {text}
      </span>
    </div>
  );
}
