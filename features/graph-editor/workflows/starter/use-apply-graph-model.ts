"use client";

import { useSetAtom } from "jotai";
import { useCallback } from "react";

import type { GraphModel } from "../../core/graph/model";
import { replaceGraphModelAtom } from "../../shell/state/editor-actions";

import { useGraphCanvasApi } from "../../canvas/GraphCanvasProvider";

export function useApplyGraphModel() {
  const replaceGraphModel = useSetAtom(replaceGraphModelAtom);
  const { requestFit } = useGraphCanvasApi();

  return useCallback(
    (model: GraphModel) => {
      const result = replaceGraphModel(model);

      if (result.status === "rejected") return false;
      requestFit(result.graph);
      return true;
    },
    [requestFit, replaceGraphModel],
  );
}
