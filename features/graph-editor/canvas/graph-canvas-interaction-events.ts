"use client";

import type { Core, EventObject } from "cytoscape";
import type { MutableRefObject } from "react";
import { useEffect, useRef } from "react";

import type {
  EdgeDraft,
  EditorMode,
  SelectionState,
} from "../shell/state/editor-state";
import {
  createEmptyEdgeDraft,
  createEmptySelection,
} from "../shell/state/editor-state";

import type { GraphContextMenuTarget } from "./graph-canvas-types";

type AtomSetter<T> = (value: T | ((current: T) => T)) => void;

type UseCytoscapeInteractionEventsOptions = {
  cyRef: MutableRefObject<Core | null>;
  mode: EditorMode;
  selectionRef: MutableRefObject<SelectionState>;
  setContextMenuTarget: (target: GraphContextMenuTarget | null) => void;
  setEdgeDraft: AtomSetter<EdgeDraft>;
  setSelection: AtomSetter<SelectionState>;
};

export function useCytoscapeInteractionEvents({
  cyRef,
  mode,
  selectionRef,
  setContextMenuTarget,
  setEdgeDraft,
  setSelection,
}: UseCytoscapeInteractionEventsOptions) {
  const lastBoxSelectionEndAtRef = useRef(0);
  const boxSelectionStartRef = useRef<{
    additive: boolean;
    selection: SelectionState;
  } | null>(null);

  useEffect(() => {
    const cy = cyRef.current;

    if (!cy) {
      return;
    }

    let boxSelectionFrame = 0;

    const onBackgroundTap = (event: EventObject) => {
      if (event.target !== cy) {
        return;
      }

      setContextMenuTarget(null);

      if (mode === "edge") {
        setEdgeDraft(createEmptyEdgeDraft());
        return;
      }

      if (mode === "select") {
        if (Date.now() - lastBoxSelectionEndAtRef.current < 500) {
          return;
        }

        setSelection(createEmptySelection());
        return;
      }
    };

    const onContextTap = (event: EventObject) => {
      const originalEvent = event.originalEvent as unknown;

      if (originalEvent instanceof Event) {
        originalEvent.preventDefault();
      }

      if (event.target === cy) {
        setContextMenuTarget(null);
      }
    };

    const onBoxStart = (event: EventObject) => {
      if (mode !== "select") {
        return;
      }

      boxSelectionStartRef.current = {
        additive: isAdditiveSelectionEvent(event.originalEvent),
        selection: selectionRef.current,
      };
    };

    const onBoxEnd = () => {
      if (mode !== "select") {
        return;
      }

      lastBoxSelectionEndAtRef.current = Date.now();
      const boxSelectionStart = boxSelectionStartRef.current;
      boxSelectionStartRef.current = null;

      if (boxSelectionFrame) {
        window.cancelAnimationFrame(boxSelectionFrame);
      }

      boxSelectionFrame = window.requestAnimationFrame(() => {
        boxSelectionFrame = 0;
        const selected = readCytoscapeSelection(cy);

        setSelection(
          boxSelectionStart?.additive
            ? mergeSelection(boxSelectionStart.selection, selected)
            : selected,
        );
      });
    };

    cy.on("tap", onBackgroundTap);
    cy.on("cxttap", onContextTap);
    cy.on("boxstart", onBoxStart);
    cy.on("boxend", onBoxEnd);

    return () => {
      cy.off("tap", onBackgroundTap);
      cy.off("cxttap", onContextTap);
      cy.off("boxstart", onBoxStart);
      cy.off("boxend", onBoxEnd);
      if (boxSelectionFrame) {
        window.cancelAnimationFrame(boxSelectionFrame);
      }
      boxSelectionStartRef.current = null;
    };
  }, [
    cyRef,
    mode,
    selectionRef,
    setContextMenuTarget,
    setEdgeDraft,
    setSelection,
  ]);
}

function readCytoscapeSelection(cy: Core): SelectionState {
  return {
    nodeIds: cy.nodes(":selected").map((node) => node.id()),
    edgeIds: cy.edges(":selected").map((edge) => edge.id()),
  };
}

function mergeSelection(
  currentSelection: SelectionState,
  nextSelection: SelectionState,
): SelectionState {
  return {
    nodeIds: mergeIds(currentSelection.nodeIds, nextSelection.nodeIds),
    edgeIds: mergeIds(currentSelection.edgeIds, nextSelection.edgeIds),
  };
}

function mergeIds<T extends string>(currentIds: T[], nextIds: T[]) {
  return [...new Set([...currentIds, ...nextIds])];
}

function isAdditiveSelectionEvent(event: unknown) {
  return (
    typeof event === "object" &&
    event !== null &&
    (readBooleanProperty(event, "shiftKey") ||
      readBooleanProperty(event, "metaKey") ||
      readBooleanProperty(event, "ctrlKey"))
  );
}

function readBooleanProperty(value: object, property: string) {
  return (value as Record<string, unknown>)[property] === true;
}
