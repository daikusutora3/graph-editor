"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

import type { GraphCanvasExportOptions } from "./graph-canvas-types";

type GraphCanvasApi = {
  editSelection: () => boolean;
  fitView: () => void;
  fitAfterNextGraphRender: () => void;
  exportPng: (detail: GraphCanvasExportOptions) => Promise<Blob>;
  isGraphOutOfView: () => boolean;
  resetZoom: () => void;
};

type GraphCanvasApiContextValue = GraphCanvasApi & {
  registerGraphCanvasApi: (api: GraphCanvasApi | null) => void;
};

const missingCanvasApi: GraphCanvasApi = {
  editSelection: () => false,
  fitView: () => {},
  fitAfterNextGraphRender: () => {},
  exportPng: () => Promise.reject(new Error("Graph canvas is not ready")),
  isGraphOutOfView: () => false,
  resetZoom: () => {},
};

const GraphCanvasApiContext = createContext<GraphCanvasApiContextValue | null>(
  null,
);

export function GraphCanvasProvider({ children }: { children: ReactNode }) {
  const apiRef = useRef<GraphCanvasApi | null>(null);

  const callApi = useCallback(
    <T,>(read: (api: GraphCanvasApi) => T) =>
      read(apiRef.current ?? missingCanvasApi),
    [],
  );

  const value = useMemo<GraphCanvasApiContextValue>(
    () => ({
      editSelection: () => callApi((api) => api.editSelection()),
      fitView: () => callApi((api) => api.fitView()),
      isGraphOutOfView: () => callApi((api) => api.isGraphOutOfView()),
      resetZoom: () => callApi((api) => api.resetZoom()),
      fitAfterNextGraphRender: () =>
        callApi((api) => api.fitAfterNextGraphRender()),
      exportPng: (detail) => callApi((api) => api.exportPng(detail)),
      registerGraphCanvasApi: (api) => {
        apiRef.current = api;
      },
    }),
    [callApi],
  );

  return (
    <GraphCanvasApiContext.Provider value={value}>
      {children}
    </GraphCanvasApiContext.Provider>
  );
}

export function useGraphCanvasApi() {
  const context = useContext(GraphCanvasApiContext);

  if (!context) {
    throw new Error(
      "useGraphCanvasApi must be used within GraphCanvasProvider",
    );
  }

  return context;
}
