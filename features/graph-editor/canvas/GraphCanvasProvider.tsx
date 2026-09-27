"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { GraphModel } from "../core/graph/model";

export type CanvasFitRequest = { id: number; graph: GraphModel };

import type { GraphCanvasExportOptions } from "./graph-canvas-types";

type GraphCanvasApi = {
  editSelection: () => boolean;
  fitView: () => void;
  exportPng: (detail: GraphCanvasExportOptions) => Promise<Blob>;
  isGraphOutOfView: () => boolean;
  resetZoom: () => void;
};

type GraphCanvasApiContextValue = GraphCanvasApi & {
  zoomPercent: number;
  notifyZoomPercent: (value: number) => void;
  fitRequest: CanvasFitRequest | null;
  requestFit: (graph: GraphModel) => void;
  completeFit: (id: number) => void;
  registerGraphCanvasApi: (api: GraphCanvasApi | null) => void;
};

const missingCanvasApi: GraphCanvasApi = {
  editSelection: () => false,
  fitView: () => {},
  exportPng: () => Promise.reject(new Error("Graph canvas is not ready")),
  isGraphOutOfView: () => false,
  resetZoom: () => {},
};

const GraphCanvasApiContext = createContext<GraphCanvasApiContextValue | null>(
  null,
);

export function GraphCanvasProvider({ children }: { children: ReactNode }) {
  const [fitRequest, setFitRequest] = useState<CanvasFitRequest | null>(null);
  const [zoomPercent, notifyZoomPercent] = useState(100);
  const fitId = useRef(0);
  const requestFit = useCallback((graph: GraphModel) => {
    setFitRequest({ id: ++fitId.current, graph });
  }, []);
  const completeFit = useCallback((id: number) => {
    setFitRequest((current) => (current?.id === id ? null : current));
  }, []);
  const apiRef = useRef<GraphCanvasApi | null>(null);
  const registerGraphCanvasApi = useCallback((api: GraphCanvasApi | null) => {
    apiRef.current = api;
  }, []);

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
      zoomPercent,
      notifyZoomPercent,
      fitRequest,
      requestFit,
      completeFit,
      exportPng: (detail) => callApi((api) => api.exportPng(detail)),
      registerGraphCanvasApi,
    }),
    [
      callApi,
      fitRequest,
      requestFit,
      completeFit,
      registerGraphCanvasApi,
      zoomPercent,
    ],
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
