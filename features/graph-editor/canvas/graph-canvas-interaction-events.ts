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
  setContextMenuTarget: (target: GraphContextMenuTarget | null) => void;
  setEdgeDraft: AtomSetter<EdgeDraft>;
  setSelection: AtomSetter<SelectionState>;
};

export function useCytoscapeInteractionEvents({
  cyRef,
  mode,
  setContextMenuTarget,
  setEdgeDraft,
  setSelection,
}: UseCytoscapeInteractionEventsOptions) {
  const lastBoxSelectionEndAtRef = useRef(0);

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

    const onBoxStart = () => {
      if (mode !== "select") {
        return;
      }

      cy.elements(":selected").unselect();
      setSelection(createEmptySelection());
    };

    const onBoxEnd = () => {
      if (mode !== "select") {
        return;
      }

      lastBoxSelectionEndAtRef.current = Date.now();

      if (boxSelectionFrame) {
        window.cancelAnimationFrame(boxSelectionFrame);
      }

      boxSelectionFrame = window.requestAnimationFrame(() => {
        boxSelectionFrame = 0;
        setSelection(readCytoscapeSelection(cy));
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
    };
  }, [cyRef, mode, setContextMenuTarget, setEdgeDraft, setSelection]);
}

function readCytoscapeSelection(cy: Core): SelectionState {
  return {
    nodeIds: cy.nodes(":selected").map((node) => node.id()),
    edgeIds: cy.edges(":selected").map((edge) => edge.id()),
  };
}
