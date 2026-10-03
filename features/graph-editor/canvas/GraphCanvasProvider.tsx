"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
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
  notifyZoomPercent: (value: number) => void;
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
const GraphCanvasFitContext = createContext<
  CanvasFitRequest | null | undefined
>(undefined);

function createZoomStore() {
  let zoomPercent = 100;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => zoomPercent,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set: (nextZoomPercent: number) => {
      if (zoomPercent === nextZoomPercent) return;
      zoomPercent = nextZoomPercent;
      listeners.forEach((listener) => listener());
    },
  };
}

const GraphCanvasZoomContext = createContext<ReturnType<
  typeof createZoomStore
> | null>(null);
const defaultZoomSnapshot = () => 100;
const skipZoomSubscription = () => () => {};

export function GraphCanvasProvider({ children }: { children: ReactNode }) {
  const [fitRequest, setFitRequest] = useState<CanvasFitRequest | null>(null);
  const [zoomStore] = useState(createZoomStore);
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
      notifyZoomPercent: zoomStore.set,
      requestFit,
      completeFit,
      exportPng: (detail) => callApi((api) => api.exportPng(detail)),
      registerGraphCanvasApi,
    }),
    [callApi, requestFit, completeFit, registerGraphCanvasApi, zoomStore],
  );

  return (
    <GraphCanvasApiContext.Provider value={value}>
      <GraphCanvasFitContext.Provider value={fitRequest}>
        <GraphCanvasZoomContext.Provider value={zoomStore}>
          {children}
        </GraphCanvasZoomContext.Provider>
      </GraphCanvasFitContext.Provider>
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

export function useGraphCanvasFitRequest() {
  const request = useContext(GraphCanvasFitContext);
  if (request === undefined) {
    throw new Error(
      "useGraphCanvasFitRequest must be used within GraphCanvasProvider",
    );
  }
  return request;
}

/** Subscribe only while a visible PNG preview needs the current zoom. */
export function useGraphCanvasZoomPercent(enabled = true) {
  const store = useContext(GraphCanvasZoomContext);
  if (!store) {
    throw new Error(
      "useGraphCanvasZoomPercent must be used within GraphCanvasProvider",
    );
  }
  return useSyncExternalStore(
    enabled ? store.subscribe : skipZoomSubscription,
    enabled ? store.getSnapshot : defaultZoomSnapshot,
    defaultZoomSnapshot,
  );
}
