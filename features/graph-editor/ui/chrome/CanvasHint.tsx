"use client";

import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import { useI18n } from "../../i18n/I18nProvider";
import {
  edgeDraftAtom,
  editorModeAtom,
  selectionAtom,
} from "../../shell/state/editor-atoms";
import { graphAtom } from "../../shell/state/graph-atoms";

const SELECT_HINT_STORAGE_KEY = "graph-editor-select-hint-dismissed";
const SELECT_HINT_DURATION_MS = 9000;

/** Contextual guidance pill under the toolbar: edge-mode progress, or a
 * one-time explanation of select-mode gestures. */
export function CanvasHint({
  mobile,
  visible,
}: {
  mobile: boolean;
  visible: boolean;
}) {
  const { messages } = useI18n();
  const mode = useAtomValue(editorModeAtom);
  const edgeDraft = useAtomValue(edgeDraftAtom);
  const selection = useAtomValue(selectionAtom);
  const graph = useAtomValue(graphAtom);
  const showSelectHint = useSelectHint({
    active: mode === "select" && graph.nodes.length > 0,
    dismissWhen: selection.nodeIds.length > 0 || selection.edgeIds.length > 0,
  });

  if (!visible) {
    return null;
  }

  let text: string | null = null;

  if (mode === "edge") {
    const sourceNode = edgeDraft.sourceNodeId
      ? graph.nodes.find((node) => node.id === edgeDraft.sourceNodeId)
      : null;
    text = sourceNode
      ? messages.chrome.edgeHintTarget(sourceNode.label)
      : messages.chrome.edgeHintStart;
  } else if (mode === "select" && showSelectHint && !mobile) {
    text = messages.chrome.selectHint;
  }

  if (!text) {
    return null;
  }

  return (
    <HintPill position={mobile ? "top-[68px]" : "top-[84px]"} text={text} />
  );
}

export function Toast({
  message,
  mobile,
}: {
  message: string | null;
  mobile: boolean;
}) {
  if (!message) {
    return null;
  }

  return (
    <HintPill
      key={message}
      position={mobile ? "bottom-[96px]" : "bottom-[76px]"}
      text={message}
      tone="toast"
    />
  );
}

function HintPill({
  position,
  text,
  tone = "hint",
}: {
  position: string;
  text: string;
  tone?: "hint" | "toast";
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-3 z-[60] flex justify-center",
        position,
      )}
    >
      <span
        role="status"
        aria-live="polite"
        className={cn(
          "ge-pop inline-flex max-w-full items-center gap-2 rounded-full px-3 text-xs font-semibold shadow-[var(--shadow)]",
          tone === "hint"
            ? "h-[30px] bg-[var(--primary)] text-[var(--primary-text)]"
            : "ge-panel h-9 text-[var(--text)] backdrop-blur-[12px]",
        )}
      >
        <span className="truncate">{text}</span>
      </span>
    </div>
  );
}

function useSelectHint({
  active,
  dismissWhen,
}: {
  active: boolean;
  dismissWhen: boolean;
}) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(
        window.localStorage.getItem(SELECT_HINT_STORAGE_KEY) === "1",
      );
    } catch {
      setDismissed(false);
    }
  }, []);

  useEffect(() => {
    if (dismissed || !active) {
      return;
    }

    const dismiss = () => {
      setDismissed(true);
      try {
        window.localStorage.setItem(SELECT_HINT_STORAGE_KEY, "1");
      } catch {
        // Persisting the dismissal is a convenience only.
      }
    };

    if (dismissWhen) {
      dismiss();
      return;
    }

    const timeoutId = window.setTimeout(dismiss, SELECT_HINT_DURATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [active, dismissWhen, dismissed]);

  return active && !dismissed;
}
