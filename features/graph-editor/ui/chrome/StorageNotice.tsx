"use client";
import { useSyncExternalStore } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  acceptStorageBaseline,
  flushStoredGraphWrite,
  getStorageSnapshot,
  parseStoredGraph,
  STORAGE_STATE_EVENT,
  scheduleStoredGraphWrite,
} from "../../adapters/browser/stored-graph";
import { downloadBlob } from "../../adapters/browser/file-actions";
import { createEmptyGraphModel } from "../../core/graph/graph-factory";
import { serializeGraphModel } from "../../core/graph/graph-json";
import { replaceModelCommand } from "../../core/graph/graph-intents";
import { graphAtom } from "../../shell/state/graph-atoms";
import {
  commandErrorAtom,
  executeCommandAtom,
} from "../../shell/state/history-atoms";
import { useI18n } from "../../i18n/I18nProvider";
import { integrityCopy } from "../../i18n/integrity-copy";
import { useGraphCanvasApi } from "../../canvas/GraphCanvasProvider";
import { Button } from "../primitives";

const serverSnapshot = { status: "saved" as const, raw: null };
function subscribe(callback: () => void) {
  window.addEventListener(STORAGE_STATE_EVENT, callback);
  return () => window.removeEventListener(STORAGE_STATE_EVENT, callback);
}
export function StorageNotice() {
  const state = useSyncExternalStore(
    subscribe,
    getStorageSnapshot,
    () => serverSnapshot,
  );
  const graph = useAtomValue(graphAtom);
  const error = useAtomValue(commandErrorAtom);
  const execute = useSetAtom(executeCommandAtom);
  const { fitAfterNextGraphRender } = useGraphCanvasApi();
  const { locale } = useI18n();
  const copy = integrityCopy[locale === "ja" ? "ja" : "en"];
  if (state.status === "saved" && !error) return null;
  const external = parseStoredGraph(state.raw);
  const download = (raw: string, filename: string) =>
    downloadBlob(new Blob([raw], { type: "application/json" }), filename);
  const load = (fresh: boolean) => {
    const model = fresh ? createEmptyGraphModel(graph.settings) : external;
    if (!model) return;
    const result = execute(replaceModelCommand(model));
    if (result.status === "rejected") return;
    acceptStorageBaseline(state.raw);
    fitAfterNextGraphRender();
    if (fresh) scheduleStoredGraphWrite(model);
    // Loading is undoable, but must not immediately write the external document back.
  };
  return (
    <aside
      role="status"
      className="pointer-events-auto absolute inset-x-4 top-20 z-[70] mx-auto flex max-w-2xl flex-wrap items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel-solid)] p-3 text-xs text-[var(--text)] shadow-lg"
    >
      {error ? <p className="w-full">{copy.rejected}</p> : null}
      {state.status !== "saved" ? (
        <p className="w-full">{copy[state.status]}</p>
      ) : null}
      {state.status !== "pending" ? (
        <>
          <Button
            size="sm"
            onClick={() =>
              download(serializeGraphModel(graph), "graph-backup.json")
            }
          >
            {copy.backup}
          </Button>
          {state.status === "failed" ? (
            <Button size="sm" onClick={() => void flushStoredGraphWrite()}>
              {copy.retry}
            </Button>
          ) : null}
          {state.status === "conflict" && external ? (
            <Button size="sm" onClick={() => load(false)}>
              {copy.load}
            </Button>
          ) : null}
          {state.status === "invalid" ||
          (state.status === "conflict" && !external) ? (
            <>
              {state.raw !== null ? (
                <Button
                  size="sm"
                  onClick={() => download(state.raw!, "graph-original.json")}
                >
                  {copy.raw}
                </Button>
              ) : null}
              <Button size="sm" onClick={() => load(true)}>
                {copy.fresh}
              </Button>
            </>
          ) : null}
        </>
      ) : null}
    </aside>
  );
}
