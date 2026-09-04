"use client";

import type { MutableRefObject } from "react";
import { useCallback } from "react";
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

type GraphImageExportOptions = {
  cyRef: MutableRefObject<Core | null>;
  selectionRef: MutableRefObject<SelectionState>;
  suppressSelectionSyncRef: MutableRefObject<boolean>;
};

export function useGraphImageExport({
  cyRef,
  selectionRef,
  suppressSelectionSyncRef,
}: GraphImageExportOptions) {
  return useCallback(
    async (detail: GraphCanvasExportOptions) => {
      const cy = cyRef.current;

      if (!cy) {
        throw new Error("Graph canvas is not ready");
      }

      let shouldRestoreSelectionState = false;
      let selectedIds: string[] = [];
      let edgeSourceIds: string[] = [];

      try {
        if (cy.elements().length === 0) {
          throw new Error(IMAGE_EXPORT_ERROR.emptyGraph);
        }

        selectedIds = cy.elements(":selected").map((element) => element.id());
        edgeSourceIds = cy.nodes(".edge-source").map((node) => node.id());

        suppressSelectionSyncRef.current = true;

        if (!detail.includeSelection) {
          shouldRestoreSelectionState = true;
          cy.elements(":selected").unselect();
          cy.nodes(".edge-source").removeClass("edge-source");
        }

        await document.fonts?.ready;
        await nextAnimationFrame();

        return await cy.png({
          output: "blob-promise",
          full: detail.scope === "full",
          maxWidth: detail.maxWidth,
          maxHeight: detail.maxHeight,
          bg: readExportBackground(detail.background),
        });
      } catch (error) {
        throw new Error(exportImageErrorCode(error), { cause: error });
      } finally {
        if (
          shouldRestoreSelectionState &&
          cyRef.current === cy &&
          !cy.destroyed()
        ) {
          withCytoscapeBatch(cy, () => {
            selectedIds.forEach((id) => cy.getElementById(id).select());
            edgeSourceIds.forEach((id) =>
              cy.getElementById(id).addClass("edge-source"),
            );
          });
        }

        if (cyRef.current === cy && !cy.destroyed()) {
          suppressSelectionSyncRef.current = false;
          withCytoscapeBatch(cy, () => {
            syncCytoscapeSelection(cy, selectionRef.current);
          });
        } else {
          suppressSelectionSyncRef.current = false;
        }
      }
    },
    [cyRef, selectionRef, suppressSelectionSyncRef],
  );
}
