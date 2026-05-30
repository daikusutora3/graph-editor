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
  fitView: () => void;
  fitAfterNextGraphRender: () => void;
  exportPng: (detail: GraphCanvasExportOptions) => Promise<Blob>;
};

type GraphCanvasApiContextValue = GraphCanvasApi & {
  registerGraphCanvasApi: (api: GraphCanvasApi | null) => void;
};

const missingCanvasApi: GraphCanvasApi = {
  fitView: () => {},
  fitAfterNextGraphRender: () => {},
  exportPng: () => Promise.reject(new Error("Graph canvas is not ready")),
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
      fitView: () => callApi((api) => api.fitView()),
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
