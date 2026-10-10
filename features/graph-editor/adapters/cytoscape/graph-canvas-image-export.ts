"use client";

import type { MutableRefObject } from "react";
import { useMemo } from "react";
import type { Core } from "cytoscape";

import type { GraphCanvasExportOptions } from "../../core/view/types";
import type { SelectionState } from "../../core/view/types";
import {
  exportImageErrorCode,
  IMAGE_EXPORT_ERROR,
  nextAnimationFrame,
  readExportBackground,
  syncCytoscapeSelection,
} from "./graph-canvas-viewport";
import { withCytoscapeBatch } from "./cytoscape-batch";
import { awaitAbortable } from "../browser/abortable";

type GraphImageExportOptions = {
  cyRef: MutableRefObject<Core | null>;
  selectionRef: MutableRefObject<SelectionState>;
  suppressSelectionSyncRef: MutableRefObject<boolean>;
  edgeSourceNodeIdRef?: MutableRefObject<string | null>;
};

export function useGraphImageExport({
  cyRef,
  selectionRef,
  suppressSelectionSyncRef,
  edgeSourceNodeIdRef,
}: GraphImageExportOptions) {
  return useMemo(
    () =>
      createGraphImageExporter({
        cyRef,
        selectionRef,
        suppressSelectionSyncRef,
        edgeSourceNodeIdRef,
      }),
    [cyRef, selectionRef, suppressSelectionSyncRef, edgeSourceNodeIdRef],
  );
}

/** One owner for the renderer's temporary selection and draft-source state. */
export function createGraphImageExporter({
  cyRef,
  selectionRef,
  suppressSelectionSyncRef,
  edgeSourceNodeIdRef,
}: GraphImageExportOptions) {
  let tail = Promise.resolve();
  return (detail: GraphCanvasExportOptions): Promise<Blob> => {
    // A queued request belongs to the canvas on which it was requested. Never
    // silently export a replacement canvas after unmount/retry.
    const cy = cyRef.current;
    const result = tail.then(() => render(cy, detail));
    tail = result.then(
      () => {},
      () => {},
    );
    return awaitAbortable(result, detail.signal);
  };

  async function render(cy: Core | null, detail: GraphCanvasExportOptions) {
    detail.signal?.throwIfAborted();
    if (!cy || cyRef.current !== cy || cy.destroyed()) {
      throw new Error("Graph canvas is not ready");
    }

    let shouldRestoreSelectionState = false;
    let edgeSourceIds: string[] = [];
    const previouslySuppressed = suppressSelectionSyncRef.current;

    try {
      if (cy.elements().length === 0) {
        throw new Error(IMAGE_EXPORT_ERROR.emptyGraph);
      }

      edgeSourceIds = cy.nodes(".edge-source").map((node) => node.id());

      suppressSelectionSyncRef.current = true;

      if (!detail.includeSelection) {
        shouldRestoreSelectionState = true;
        cy.elements(":selected").unselect();
        cy.nodes(".edge-source").removeClass("edge-source");
      }

      await awaitAbortable(
        Promise.resolve(document.fonts?.ready),
        detail.signal,
      );
      await awaitAbortable(nextAnimationFrame(), detail.signal);
      detail.signal?.throwIfAborted();
      if (cyRef.current !== cy || cy.destroyed()) {
        throw new Error("Graph canvas is not ready");
      }
      // Editing or a mode change may run while fonts/the frame are pending.
      // Apply the requested selection policy immediately before rendering.
      withCytoscapeBatch(cy, () => {
        if (detail.includeSelection)
          syncCytoscapeSelection(cy, selectionRef.current);
        else {
          cy.elements(":selected").unselect();
          cy.nodes(".edge-source").removeClass("edge-source");
        }
      });

      // PNG encoding cannot be interrupted. Keep the renderer owner until it
      // settles, even when the preview caller has already stopped waiting.
      const blob = await cy.png({
        output: "blob-promise",
        full: detail.scope !== "viewport",
        scale:
          detail.scope === "natural" || detail.scope === "natural-fixed"
            ? cy.zoom()
            : undefined,
        maxWidth: detail.maxWidth,
        maxHeight: detail.maxHeight,
        bg: readExportBackground(detail.background),
      });
      detail.signal?.throwIfAborted();
      return blob;
    } catch (error) {
      if (detail.signal?.aborted) throw detail.signal.reason;
      throw new Error(exportImageErrorCode(error), { cause: error });
    } finally {
      try {
        if (
          shouldRestoreSelectionState &&
          cyRef.current === cy &&
          !cy.destroyed()
        ) {
          withCytoscapeBatch(cy, () => {
            const currentSourceIds = edgeSourceNodeIdRef
              ? edgeSourceNodeIdRef.current
                ? [edgeSourceNodeIdRef.current]
                : []
              : edgeSourceIds;
            cy.nodes(".edge-source").removeClass("edge-source");
            currentSourceIds.forEach((id) =>
              cy.getElementById(id).addClass("edge-source"),
            );
          });
        }

        if (cyRef.current === cy && !cy.destroyed()) {
          withCytoscapeBatch(cy, () => {
            syncCytoscapeSelection(cy, selectionRef.current);
          });
        }
      } finally {
        suppressSelectionSyncRef.current = previouslySuppressed;
      }
    }
  }
}
