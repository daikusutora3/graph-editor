"use client";
import { useId, useMemo, useSyncExternalStore } from "react";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { ArrowLeftRight, Download } from "lucide-react";
import {
  getStorageSnapshot,
  parseStoredGraph,
  STORAGE_STATE_EVENT,
  type StorageSnapshot,
} from "../../adapters/browser/stored-graph";
import { downloadBlob } from "../../adapters/browser/file-actions";
import { serializeGraphModel } from "../../core/graph/graph-json";
import {
  resolveStorageConflictAtom,
  retryGraphSaveAtom,
} from "../../shell/state/editor-actions";
import { graphAtom } from "../../shell/state/graph-atoms";
import {
  commandErrorAtom,
  type CommandFailure,
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
  const store = useStore();
  const error = useAtomValue(commandErrorAtom);
  const resolveConflict = useSetAtom(resolveStorageConflictAtom);
  const retrySave = useSetAtom(retryGraphSaveAtom);
  const { requestFit } = useGraphCanvasApi();
  const download = (raw: string, filename: string) =>
    downloadBlob(new Blob([raw], { type: "application/json" }), filename);
  const load = (fresh: boolean) => {
    const result = resolveConflict(state.raw, fresh);
    if (result.status !== "rejected") requestFit(result.graph);
  };
  return (
    <StorageNoticeContent
      state={state}
      error={error}
      onDownload={() =>
        download(serializeGraphModel(store.get(graphAtom)), "graph-backup.json")
      }
      onRetry={() => void retrySave()}
      onLoad={load}
      onDownloadOriginal={() => {
        if (state.raw !== null) download(state.raw, "graph-original.json");
      }}
    />
  );
}

export function StorageNoticeContent({
  state,
  error,
  onDownload,
  onRetry,
  onLoad,
  onDownloadOriginal,
}: {
  state: StorageSnapshot;
  error: CommandFailure | null;
  onDownload: () => void;
  onRetry: () => void;
  onLoad: (fresh: boolean) => void;
  onDownloadOriginal: () => void;
}) {
  const { locale } = useI18n();
  const copy = integrityCopy[locale];
  const id = useId();
  const needsStorageAttention =
    state.status !== "saved" && state.status !== "pending";
  const external = useMemo(
    () => (state.status === "conflict" ? parseStoredGraph(state.raw) : null),
    [state.raw, state.status],
  );
  if (!needsStorageAttention && !error) return null;
  const conflict = state.status === "conflict";
  const description = external
    ? copy.conflict
    : state.raw === null
      ? copy.conflictDeleted
      : copy.conflictInvalid;
  const actionClass =
    "h-auto min-h-9 w-full px-3 py-2 leading-snug whitespace-normal";
  return (
    <aside
      data-storage-notice={state.status}
      className="pointer-events-auto absolute inset-x-3 top-20 z-[70] mx-auto max-h-[calc(100dvh-10rem)] max-w-xl overflow-y-auto overscroll-contain rounded-lg border border-[var(--line)] bg-[var(--panel-solid)] p-3 text-xs leading-relaxed text-[var(--text)] shadow-lg"
    >
      <div role="status">
        {needsStorageAttention ? (
          <p>{conflict ? description : copy[state.status]}</p>
        ) : null}
        {error ? (
          <p className={needsStorageAttention ? "mt-2" : undefined}>
            {error.reason === "coordinate-range"
              ? copy.coordinatesRejected
              : copy.rejected}
          </p>
        ) : null}
      </div>
      {state.status !== "pending" ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="min-w-0">
            <Button
              variant="primary"
              className={actionClass}
              aria-describedby={`${id}-backup`}
              tooltip={copy.backupHint}
              tooltipSide="top"
              onClick={onDownload}
            >
              <Download aria-hidden="true" className="size-4 shrink-0" />
              {copy.backup}
            </Button>
            <p id={`${id}-backup`} className="sr-only">
              {copy.backupHint}
            </p>
          </div>
          {state.status === "failed" ? (
            <Button
              variant="secondary"
              className={`${actionClass} self-start`}
              onClick={onRetry}
            >
              {copy.retry}
            </Button>
          ) : null}
          {conflict && external ? (
            <div className="min-w-0">
              <Button
                variant="secondary"
                className={actionClass}
                aria-describedby={`${id}-load`}
                tooltip={copy.loadHint}
                tooltipSide="top"
                onClick={() => onLoad(false)}
              >
                <ArrowLeftRight
                  aria-hidden="true"
                  className="size-4 shrink-0"
                />
                {copy.load}
              </Button>
              <p id={`${id}-load`} className="sr-only">
                {copy.loadHint}
              </p>
            </div>
          ) : null}
          {state.status === "invalid" || (conflict && !external) ? (
            <div className="flex min-w-0 flex-col gap-2">
              {state.raw !== null ? (
                <Button
                  variant="secondary"
                  className={actionClass}
                  onClick={onDownloadOriginal}
                >
                  {copy.raw}
                </Button>
              ) : null}
              <Button
                variant="secondary"
                className={actionClass}
                onClick={() => onLoad(true)}
              >
                {copy.fresh}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
