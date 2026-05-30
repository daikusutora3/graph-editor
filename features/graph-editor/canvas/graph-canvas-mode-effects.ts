"use client";

import type { Core } from "cytoscape";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useEffect } from "react";

import type { GraphModel } from "../core/graph/model";
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
import type { InlineEditTarget } from "./graph-canvas-types";

type AtomSetter<T> = (value: T | ((current: T) => T)) => void;

type GraphCanvasModeEffectsOptions = {
  cyRef: MutableRefObject<Core | null>;
  edgeDraft: EdgeDraft;
  graph: GraphModel;
  mode: EditorMode;
  setContextMenuTarget: Dispatch<SetStateAction<GraphContextMenuTarget | null>>;
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
      setEdgeDraft(createEmptyEdgeDraft());
      cy.nodes().removeClass("edge-source");
    }
  }, [cyRef, mode, setEdgeDraft, setSelection]);

  useEffect(() => {
    const cy = cyRef.current;

    if (!cy) {
      return;
    }

    cy.nodes().removeClass("edge-source");

    if (edgeDraft.sourceNodeId) {
      cy.getElementById(edgeDraft.sourceNodeId).addClass("edge-source");
    }
  }, [cyRef, edgeDraft.sourceNodeId]);

  useEffect(() => {
    if (edgeDraft.message?.kind !== "success") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setEdgeDraft((currentDraft) =>
        currentDraft.message?.kind === "success"
          ? { ...currentDraft, message: null }
          : currentDraft,
      );
    }, 1500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [edgeDraft.message, setEdgeDraft]);

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
