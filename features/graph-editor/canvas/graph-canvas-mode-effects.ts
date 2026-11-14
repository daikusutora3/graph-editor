"use client";

import type { Core } from "cytoscape";
import { getCytoscapeElement } from "../adapters/cytoscape/cytoscape-ids";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useEffect } from "react";

import type { GraphModel } from "../core/graph/model";
import type {
  EdgeDraft,
  EditorMode,
  SelectionState,
} from "../shell/state/editor-state";
import { createEmptySelection } from "../shell/state/editor-state";

import type { GraphContextMenuTarget } from "./graph-canvas-types";
import type { InlineEditTarget } from "./graph-canvas-types";

type AtomSetter<T> = (value: T | ((current: T) => T)) => void;

type GraphCanvasModeEffectsOptions = {
  cyRef: MutableRefObject<Core | null>;
  edgeDraft: EdgeDraft;
  graph: GraphModel;
  mode: EditorMode;
  setContextMenuTarget: (target: GraphContextMenuTarget | null) => void;
  setEdgeDraft: AtomSetter<EdgeDraft>;
  setInlineEdit: Dispatch<SetStateAction<InlineEditTarget | null>>;
  setSelection: AtomSetter<SelectionState>;
};

export function useGraphCanvasModeEffects({
  cyRef,
  edgeDraft,
  graph,
  mode,
  setContextMenuTarget,
  setEdgeDraft,
  setInlineEdit,
  setSelection,
}: GraphCanvasModeEffectsOptions) {
  useEffect(() => {
    const cy = cyRef.current;

    if (!cy) {
      return;
    }

    cy.selectionType("single");
    cy.autoungrabify(true);
    cy.boxSelectionEnabled(mode === "select");

    if (mode !== "select") {
      cy.autounselectify(false);
      cy.elements().unselect();
      cy.autounselectify(true);
      setSelection(createEmptySelection());
    } else {
      cy.autounselectify(false);
    }

    if (mode !== "edge") {
      setEdgeDraft(null);
      cy.nodes(".edge-source").removeClass("edge-source");
    }
  }, [cyRef, mode, setEdgeDraft, setSelection]);

  useEffect(() => {
    const cy = cyRef.current;

    if (!cy) {
      return;
    }

    cy.nodes(".edge-source").removeClass("edge-source");

    if (edgeDraft) {
      getCytoscapeElement(cy, edgeDraft).addClass("edge-source");
    }
  }, [cyRef, edgeDraft]);

  useEffect(() => {
    setContextMenuTarget(null);
    setInlineEdit(null);
  }, [graph, mode, setContextMenuTarget, setInlineEdit]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContextMenuTarget(null);
      }
    };

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [setContextMenuTarget]);
}
