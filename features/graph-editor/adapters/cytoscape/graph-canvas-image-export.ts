"use client";

import type { MutableRefObject } from "react";
import { useCallback } from "react";
import type { Core } from "cytoscape";

import type { GraphCanvasExportOptions } from "../../canvas/graph-canvas-types";
import {
  exportImageErrorMessage,
  nextAnimationFrame,
  readExportBackground,
} from "./graph-canvas-viewport";

type GraphImageExportOptions = {
  cyRef: MutableRefObject<Core | null>;
  suppressSelectionSyncRef: MutableRefObject<boolean>;
};

export function useGraphImageExport({
  cyRef,
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
          throw new Error("グラフが空です");
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

        const maxLongEdge = Math.min(
          detail.maxWidth ?? Number.POSITIVE_INFINITY,
          detail.maxHeight ?? Number.POSITIVE_INFINITY,
        );
        const renderedBox = cy.elements().renderedBoundingBox({
          includeLabels: true,
          includeOverlays: true,
        });
        const renderedLongEdge = Math.max(
          renderedBox.w || 0,
          renderedBox.h || 0,
        );
        const scale =
          Number.isFinite(maxLongEdge) && renderedLongEdge > 0
            ? maxLongEdge / renderedLongEdge
            : 1;

        return await cy.png({
          output: "blob-promise",
          full: detail.scope === "full",
          scale,
          maxWidth: detail.maxWidth,
          maxHeight: detail.maxHeight,
          bg: readExportBackground(detail.background),
        });
      } catch (error) {
        throw new Error(exportImageErrorMessage(error));
      } finally {
        if (shouldRestoreSelectionState) {
          cy.batch(() => {
            selectedIds.forEach((id) => cy.getElementById(id).select());
            edgeSourceIds.forEach((id) =>
              cy.getElementById(id).addClass("edge-source"),
            );
          });
        }

        suppressSelectionSyncRef.current = false;
      }
    },
    [cyRef, suppressSelectionSyncRef],
  );
}
