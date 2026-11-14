"use client";

import { useStore } from "jotai";
import { useEffect } from "react";

import { useGraphCanvasApi } from "../canvas/GraphCanvasProvider";
import { registerGraphWebMcp, type GraphModelContext } from "./graph-webmcp";

export function useGraphWebMcp(ready: boolean) {
  const store = useStore();
  const { requestFit } = useGraphCanvasApi();
  useEffect(() => {
    if (!ready) return;
    const modelContext = (
      document as Document & { modelContext?: GraphModelContext }
    ).modelContext;
    if (!modelContext || typeof modelContext.registerTool !== "function")
      return;
    return registerGraphWebMcp(modelContext, store, requestFit);
  }, [ready, requestFit, store]);
}
