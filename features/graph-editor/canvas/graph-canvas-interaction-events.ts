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
          setSelection({
            nodeIds: cy.nodes(":selected").map((node) => node.id()),
            edgeIds: cy.edges(":selected").map((edge) => edge.id()),
          });
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

    const onBoxEnd = () => {
      if (mode !== "select") {
        return;
      }

      lastBoxSelectionEndAtRef.current = Date.now();
      setSelection({
        nodeIds: cy.nodes(":selected").map((node) => node.id()),
        edgeIds: cy.edges(":selected").map((edge) => edge.id()),
      });
    };

    cy.on("tap", onBackgroundTap);
    cy.on("cxttap", onContextTap);
    cy.on("boxend", onBoxEnd);

    return () => {
      cy.off("tap", onBackgroundTap);
      cy.off("cxttap", onContextTap);
      cy.off("boxend", onBoxEnd);
    };
  }, [cyRef, mode, setContextMenuTarget, setEdgeDraft, setSelection]);
}
