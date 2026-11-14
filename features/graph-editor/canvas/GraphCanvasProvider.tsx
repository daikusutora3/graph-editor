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
  resetZoom: () => void;
};

type GraphCanvasApiContextValue = GraphCanvasApi & {
  notifyViewportSignature: (value: string) => void;
  notifyExportScaleSignature: (value: string) => void;
  requestFit: (graph: GraphModel) => void;
  completeFit: (id: number) => void;
  registerGraphCanvasApi: (api: GraphCanvasApi | null) => void;
};

const missingCanvasApi: GraphCanvasApi = {
  editSelection: () => false,
  fitView: () => {},
  exportPng: () => Promise.reject(new Error("Graph canvas is not ready")),
  resetZoom: () => {},
};

const GraphCanvasApiContext = createContext<GraphCanvasApiContextValue | null>(
  null,
);
const GraphCanvasFitContext = createContext<
  CanvasFitRequest | null | undefined
>(undefined);

function createSnapshotStore<T>(initialSnapshot: T) {
  let snapshot = initialSnapshot;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set: (nextSnapshot: T) => {
      if (snapshot === nextSnapshot) return;
      snapshot = nextSnapshot;
      listeners.forEach((listener) => listener());
    },
  };
}

const GraphCanvasViewportContext = createContext<ReturnType<
  typeof createSnapshotStore<string>
> | null>(null);
const GraphCanvasExportScaleContext = createContext<ReturnType<
  typeof createSnapshotStore<string>
> | null>(null);
const defaultViewportSnapshot = () => "";
const skipSubscription = () => () => {};

export function GraphCanvasProvider({ children }: { children: ReactNode }) {
  const [fitRequest, setFitRequest] = useState<CanvasFitRequest | null>(null);
  const [viewportStore] = useState(() => createSnapshotStore(""));
  const [exportScaleStore] = useState(() => createSnapshotStore(""));
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

  const value = useMemo<GraphCanvasApiContextValue>(
    () => ({
      editSelection: () => (apiRef.current ?? missingCanvasApi).editSelection(),
      fitView: () => (apiRef.current ?? missingCanvasApi).fitView(),
      resetZoom: () => (apiRef.current ?? missingCanvasApi).resetZoom(),
      notifyViewportSignature: viewportStore.set,
      notifyExportScaleSignature: exportScaleStore.set,
      requestFit,
      completeFit,
      exportPng: (detail) =>
        (apiRef.current ?? missingCanvasApi).exportPng(detail),
      registerGraphCanvasApi,
    }),
    [
      requestFit,
      completeFit,
      registerGraphCanvasApi,
      viewportStore,
      exportScaleStore,
    ],
  );

  return (
    <GraphCanvasApiContext.Provider value={value}>
      <GraphCanvasFitContext.Provider value={fitRequest}>
        <GraphCanvasViewportContext.Provider value={viewportStore}>
          <GraphCanvasExportScaleContext.Provider value={exportScaleStore}>
            {children}
          </GraphCanvasExportScaleContext.Provider>
        </GraphCanvasViewportContext.Provider>
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

export function useGraphCanvasViewportSignature(enabled: boolean) {
  const store = useContext(GraphCanvasViewportContext);
  if (!store) {
    throw new Error(
      "useGraphCanvasViewportSignature must be used within GraphCanvasProvider",
    );
  }
  return useSyncExternalStore(
    enabled ? store.subscribe : skipSubscription,
    enabled ? store.getSnapshot : defaultViewportSnapshot,
    defaultViewportSnapshot,
  );
}

export function useGraphCanvasExportScaleSignature(enabled: boolean) {
  const store = useContext(GraphCanvasExportScaleContext);
  if (!store) {
    throw new Error(
      "useGraphCanvasExportScaleSignature must be used within GraphCanvasProvider",
    );
  }
  return useSyncExternalStore(
    enabled ? store.subscribe : skipSubscription,
    enabled ? store.getSnapshot : defaultViewportSnapshot,
    defaultViewportSnapshot,
  );
}
