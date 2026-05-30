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
  const { fitAfterNextGraphRender } = useGraphCanvasApi();

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
      replaceGraphModel(model, {
        clearEdgeDraft,
        clearSelection,
        selectMode,
      });

      if (fitAfterUpdate) {
        fitAfterNextGraphRender();
      }
    },
    [fitAfterNextGraphRender, replaceGraphModel],
  );
}
