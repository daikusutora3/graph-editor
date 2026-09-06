"use client";

import { useSetAtom } from "jotai";
import { useCallback } from "react";

import type { GraphModel } from "../../core/graph/model";
import { replaceGraphModelAtom } from "../../shell/state/editor-actions";

import { useGraphCanvasApi } from "../../canvas/GraphCanvasProvider";

type ApplyGraphModelOptions = {
  clearEdgeDraft?: boolean;
  clearSelection?: boolean;
  fitAfterUpdate?: boolean;
  selectMode?: boolean;
};

export function useApplyGraphModel() {
  const replaceGraphModel = useSetAtom(replaceGraphModelAtom);
  const { requestFit } = useGraphCanvasApi();

  return useCallback(
    (
      model: GraphModel,
      {
        clearEdgeDraft = false,
        clearSelection = false,
        fitAfterUpdate = false,
        selectMode = false,
      }: ApplyGraphModelOptions = {},
    ) => {
      const result = replaceGraphModel(model, {
        clearEdgeDraft,
        clearSelection,
        selectMode,
      });

      if (result.status === "rejected") return false;
      if (fitAfterUpdate) {
        requestFit(result.graph);
      }
      return true;
    },
    [requestFit, replaceGraphModel],
  );
}
