"use client";

import { useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { useI18n } from "../../i18n/I18nProvider";
import {
  edgeDraftAtom,
  editorModeAtom,
  selectionAtom,
} from "../../shell/state/editor-atoms";
import { graphAtom } from "../../shell/state/graph-atoms";

const HINT_STORAGE_PREFIX = "graph-editor-hint-learned:";
/** How long the user has to sit still before a hint offers help. */
const HINT_IDLE_MS = 2500;

type HintId =
  | "place-node"
  | "connect"
  | "edge-start"
  | "edge-target"
  | "select";

/**
 * Quiet guidance pill under the toolbar. Hints stay hidden while the user is
 * acting; one appears only after a pause in a state where the next step is not
 * obvious, and never again once that step has been performed.
 */
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
  const hasNodes = graph.nodes.length > 0;
  const hasEdges = graph.edges.length > 0;
  const hasSelection =
    selection.nodeIds.length > 0 || selection.edgeIds.length > 0;
  const sourceNode = edgeDraft.sourceNodeId
    ? graph.nodes.find((node) => node.id === edgeDraft.sourceNodeId)
    : null;

  const idle = useIdle(HINT_IDLE_MS);
  const showPlaceNode = useStuckHint({
    id: "place-node",
    active: visible && mode === "node" && !hasNodes,
    done: hasNodes,
  });
  const showConnect = useStuckHint({
    id: "connect",
    active: visible && mode === "node" && hasNodes && !hasEdges,
    done: hasEdges,
  });
  const showEdgeStart = useStuckHint({
    id: "edge-start",
    active: visible && mode === "edge" && !sourceNode,
    done: Boolean(sourceNode) || hasEdges,
  });
  const showEdgeTarget = useStuckHint({
    id: "edge-target",
    active: visible && mode === "edge" && Boolean(sourceNode),
    done: hasEdges,
  });
  const showSelect = useStuckHint({
    id: "select",
    active:
      visible && !mobile && mode === "select" && hasNodes && !hasSelection,
    done: hasSelection,
  });

  if (!visible || !idle) {
    return null;
  }

  const text = showPlaceNode
    ? messages.chrome.nodeHintEmpty
    : showConnect
      ? messages.chrome.nodeHintConnect
      : showEdgeStart
        ? messages.chrome.edgeHintStart
        : showEdgeTarget && sourceNode
          ? messages.chrome.edgeHintTarget(sourceNode.label)
          : showSelect
            ? messages.chrome.selectHint
            : null;

  if (!text) {
    return null;
  }

  return (
    <HintPill position={mobile ? "top-[68px]" : "top-[84px]"} text={text} />
  );
}

/** True once the user has not touched pointer or keyboard for `delayMs`. */
function useIdle(delayMs: number) {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    let timeoutId = window.setTimeout(() => setIdle(true), delayMs);
    const reset = () => {
      setIdle(false);
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => setIdle(true), delayMs);
    };
    const events = ["pointerdown", "pointermove", "keydown", "wheel"] as const;

    for (const event of events) {
      window.addEventListener(event, reset, { passive: true });
    }

    return () => {
      window.clearTimeout(timeoutId);
      for (const event of events) {
        window.removeEventListener(event, reset);
      }
    };
  }, [delayMs]);

  return idle;
}

/**
 * A hint is offered while `active`. Once the user performs the step (`done`)
 * after the hint was armed, it is remembered as learned and never shown again.
 */
function useStuckHint({
  id,
  active,
  done,
}: {
  id: HintId;
  active: boolean;
  done: boolean;
}) {
  const storageKey = `${HINT_STORAGE_PREFIX}${id}`;
  const [learned, setLearned] = useState(true);
  const armedRef = useRef(false);

  useEffect(() => {
    try {
      setLearned(window.localStorage.getItem(storageKey) === "1");
    } catch {
      setLearned(false);
    }
  }, [storageKey]);

  useEffect(() => {
    if (active) {
      armedRef.current = true;
      return;
    }

    if (done && armedRef.current && !learned) {
      setLearned(true);
      try {
        window.localStorage.setItem(storageKey, "1");
      } catch {
        // Remembering the hint is a convenience only.
      }
    }
  }, [active, done, learned, storageKey]);

  return active && !learned;
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
