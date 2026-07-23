"use client";

import { useAtomValue } from "jotai";
import { Search, X } from "lucide-react";
import { type FocusEvent, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

import type { GraphModel } from "../core/graph/model";
import { useI18n } from "../i18n/I18nProvider";
import {
  clampSizedSampleNodeCount,
  createSampleGraph,
  createSizedSampleGraph,
  getSizedSampleGraphMaxNodes,
  isSizedSampleGraphKind,
  sizedKnightMoveKinds,
  type SampleGraphKind,
  type SizedKnightMoveKind,
  type SizedSampleGraphKind,
} from "../samples/sample-graphs";
import {
  sampleGraphCount,
  sampleGraphGroups,
  type SampleGraphItem,
} from "../samples/registry";
import { graphAtom } from "../shell/state/graph-atoms";
import { useApplyGraphModel } from "../workflows/starter/use-apply-graph-model";

import { SampleGraphPreview } from "./SampleGraphPreview";
import {
  SAMPLE_CARD_LAYOUT_CLASS,
  SAMPLE_GALLERY_GRID_CLASS,
  SAMPLE_PREVIEW_FRAME_CLASS,
} from "./sample-gallery-layout";

type SampleGalleryPaneProps = {
  onSampleApplied: () => void;
};

type SizedSampleValues = {
  columns: number;
  knightMove: SizedKnightMoveKind;
  nodeCount: number;
  rows: number;
};

const POSITIVE_INTEGER_INPUT_PATTERN = /^\d*$/;

export function SampleGalleryPane({ onSampleApplied }: SampleGalleryPaneProps) {
  const graph = useAtomValue(graphAtom);
  const { locale, messages } = useI18n();
  const applyGraphModel = useApplyGraphModel();
  const [sampleQuery, setSampleQuery] = useState("");
  const filteredSampleGroups = useMemo(() => {
    const query = sampleQuery.trim().toLowerCase();

    return sampleGraphGroups
      .map((group) => ({
        ...group,
        samples: group.samples.filter((sample) => {
          const groupCopy = messages.samples.group[group.key];
          const sampleCopy = messages.samples.item[sample.kind];
          const sampleTitle = sampleCopy?.title ?? sample.label;
          const sampleSubtitle =
            sampleCopy?.subtitle ??
            (locale === "ja"
              ? sample.subtitle
              : humanizeSampleKind(sample.kind));
          if (!query) {
            return true;
          }

          const haystack =
            `${groupCopy.label} ${groupCopy.note} ${sample.kind} ${sampleTitle} ${sampleSubtitle}`.toLowerCase();
          return haystack.includes(query);
        }),
      }))
      .filter((group) => group.samples.length > 0);
  }, [locale, messages, sampleQuery]);
  const filteredSampleCount = filteredSampleGroups.reduce(
    (count, group) => count + group.samples.length,
    0,
  );

  const generateSample = (kind: SampleGraphKind) => {
    const model = createSampleGraph(kind, graph.settings);
    applyGraphModel(model, {
      clearEdgeDraft: true,
      clearSelection: true,
      fitAfterUpdate: true,
      selectMode: true,
    });
    onSampleApplied();
  };
  const generateSizedSample = (
    kind: SizedSampleGraphKind,
    values: SizedSampleValues,
  ) => {
    const usesGridDimensions = kind === "grid" || kind === "knight";
    const parsedNodeCount = usesGridDimensions
      ? values.rows * values.columns
      : values.nodeCount;
    const normalizedNodeCount = clampSizedSampleNodeCount(
      kind,
      parsedNodeCount,
    );
    const model = createSizedSampleGraph(
      kind,
      normalizedNodeCount,
      graph.settings,
      usesGridDimensions
        ? {
            columns: values.columns,
            knightMove: values.knightMove,
            rows: values.rows,
          }
        : undefined,
    );
    applyGraphModel(model, {
      clearEdgeDraft: true,
      clearSelection: true,
      fitAfterUpdate: true,
      selectMode: true,
    });
    onSampleApplied();
  };

  return (
    <div className="gv-sample-gallery flex min-h-0 flex-1 flex-col">
      <SampleGalleryFilter
        query={sampleQuery}
        total={sampleGraphCount}
        shown={filteredSampleCount}
        onQueryChange={setSampleQuery}
      />

      <div className="gv-scrollbar flex min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto px-[var(--app-space-3)] pt-[var(--app-space-2)] pb-[var(--app-space-3)]">
        {filteredSampleGroups.length > 0 ? (
          filteredSampleGroups.map((group) => (
            <section key={group.label} className="gv-sample-group space-y-2">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-[var(--app-space-3)] px-1">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="gv-section-label">
                    {messages.samples.group[group.key].label}
                  </div>
                  <div className="text-[length:var(--app-text-micro)] leading-tight font-semibold break-words whitespace-normal text-[var(--text-mute)]">
                    {messages.samples.group[group.key].note}
                  </div>
                </div>
                <div className="font-mono text-[length:var(--app-text-micro)] font-extrabold text-[var(--text-mute)]">
                  {group.samples.length}
                </div>
              </div>
              <div className={SAMPLE_GALLERY_GRID_CLASS}>
                {group.samples.map((sample) => (
                  <SampleCard
                    key={sample.kind}
                    sample={sample}
                    settings={graph.settings}
                    onApply={() => generateSample(sample.kind)}
                    onApplySized={generateSizedSample}
                  />
                ))}
              </div>
            </section>
          ))
        ) : (
          <div className="rounded-[var(--app-radius-md)] border border-[var(--divider)] bg-[var(--canvas-overlay-bg)] px-[var(--app-space-5)] py-[var(--app-space-7)] text-center shadow-[var(--app-shadow-card)] backdrop-blur-md">
            <div className="[font-family:var(--app-font-display)] text-[length:var(--app-text-title)] font-extrabold text-[var(--text)]">
              {messages.samples.empty}
            </div>
            <button
              type="button"
              onClick={() => {
                setSampleQuery("");
              }}
              className="gv-control mt-[var(--app-space-4)] h-8 px-[var(--app-space-4)] text-[length:var(--app-text-xs)]"
            >
              {messages.samples.clearSearch}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function clampPositiveInteger(value: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.min(100, Math.round(value)));
}

function SampleGalleryFilter({
  query,
  total,
  shown,
  onQueryChange,
}: {
  query: string;
  total: number;
  shown: number;
  onQueryChange: (query: string) => void;
}) {
  const { messages } = useI18n();

  return (
    <div className="flex flex-wrap items-center gap-[var(--app-space-2)] px-[var(--app-space-3)] pt-[var(--app-space-2)] pb-[var(--app-space-3)]">
      <label className="flex h-8 min-w-[200px] flex-[1_1_220px] items-center gap-[var(--app-space-2)] rounded-[var(--app-radius-sm)] bg-[var(--state-control-bg)] px-[var(--app-space-3)] text-[var(--text-mute)] focus-within:ring-2 focus-within:ring-[var(--state-focus-ring)]">
        <Search className="size-3.5 shrink-0" aria-hidden="true" />
        <input
          type="search"
          name="sample-search"
          value={query}
          autoComplete="off"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={messages.samples.searchPlaceholder}
          aria-label={messages.samples.searchAria}
          className="min-w-0 flex-1 bg-transparent text-[length:var(--app-text-sm)] font-semibold text-[var(--text)] outline-none placeholder:text-[var(--text-mute)]"
        />
        {query ? (
          <button
            type="button"
            aria-label={messages.samples.clearSearch}
            onClick={() => onQueryChange("")}
            className="grid size-5 place-items-center rounded-full text-[var(--text-mute)] hover:bg-[var(--state-hover-bg)] hover:text-[var(--state-hover-text)] focus-visible:ring-2 focus-visible:ring-[var(--state-focus-ring)] focus-visible:outline-none"
          >
            <X className="size-3" aria-hidden="true" />
          </button>
        ) : null}
      </label>
      <div className="ml-auto shrink-0 font-mono text-[length:var(--app-text-micro)] font-extrabold text-[var(--text-mute)]">
        {shown} / {total}
      </div>
    </div>
  );
}

function SampleCard({
  sample,
  settings,
  onApply,
  onApplySized,
}: {
  sample: SampleGraphItem;
  settings: GraphModel["settings"];
  onApply: () => void;
  onApplySized: (kind: SizedSampleGraphKind, values: SizedSampleValues) => void;
}) {
  const { locale, messages } = useI18n();
  const title = messages.samples.item[sample.kind]?.title ?? sample.label;
  const subtitle =
    messages.samples.item[sample.kind]?.subtitle ??
    (locale === "ja" ? sample.subtitle : humanizeSampleKind(sample.kind));
  const model = useMemo(
    () => createSampleGraph(sample.kind, settings),
    [sample.kind, settings],
  );
  const [nodeCount, setNodeCount] = useState(() => String(model.nodes.length));
  const [rows, setRows] = useState(() => (sample.kind === "grid" ? "3" : "4"));
  const [columns, setColumns] = useState(() =>
    sample.kind === "grid" ? "3" : "4",
  );
  const [knightMove, setKnightMove] = useState<SizedKnightMoveKind>("standard");
  const sizedKind = isSizedSampleGraphKind(sample.kind) ? sample.kind : null;
  const usesGridDimensions = sizedKind === "grid" || sizedKind === "knight";

  const sampleSummary = (
    <>
      <span className={cn(SAMPLE_PREVIEW_FRAME_CLASS, "bg-[var(--bg-deep)]")}>
        <SampleGraphPreview
          model={model}
          sampleKind={sample.kind}
          width={106}
          height={80}
        />
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="max-w-full min-w-0 py-px [font-family:var(--app-font-display)] text-[15px] leading-[1.15] font-extrabold break-words whitespace-normal text-[var(--text)]">
          {title}
        </span>
        <span className="min-w-0 text-[13px] leading-tight font-semibold [overflow-wrap:anywhere] break-words whitespace-normal text-[var(--text-mute)]">
          {subtitle}
        </span>
      </span>
    </>
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--app-radius-md)] border border-[var(--divider)] bg-[var(--surface)]",
      )}
    >
      <div className={SAMPLE_CARD_LAYOUT_CLASS}>{sampleSummary}</div>
      <form
        className="flex min-h-14 flex-wrap items-end gap-[var(--app-space-2)] border-t border-[var(--divider)] px-[var(--app-space-3)] py-[var(--app-space-2)]"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();

          if (!sizedKind) {
            onApply();
            return;
          }

          const normalizedRows = clampPositiveInteger(Number(rows), 4);
          const normalizedColumns = clampPositiveInteger(Number(columns), 4);
          const normalizedNodeCount = clampSizedSampleNodeCount(
            sizedKind,
            Number(nodeCount),
          );

          setNodeCount(String(normalizedNodeCount));
          setRows(String(normalizedRows));
          setColumns(String(normalizedColumns));
          onApplySized(sizedKind, {
            columns: normalizedColumns,
            knightMove,
            nodeCount: normalizedNodeCount,
            rows: normalizedRows,
          });
        }}
      >
        {sizedKind ? (
          usesGridDimensions ? (
            <>
              <CardNumberInput
                label={messages.samples.sizedRowsLabel}
                value={rows}
                onChange={setRows}
              />
              <CardNumberInput
                label={messages.samples.sizedColumnsLabel}
                value={columns}
                onChange={setColumns}
              />
              {sizedKind === "knight" ? (
                <label className="flex min-w-[130px] flex-[1_1_130px] flex-col gap-1">
                  <span className="gv-section-label">
                    {messages.samples.sizedKnightMoveLabel}
                  </span>
                  <select
                    value={knightMove}
                    aria-label={messages.samples.sizedKnightMoveLabel}
                    onChange={(event) =>
                      setKnightMove(event.target.value as SizedKnightMoveKind)
                    }
                    className="gv-control h-8 w-full px-[var(--app-space-2)] text-[length:var(--app-text-xs)]"
                  >
                    {sizedKnightMoveKinds.map((move) => (
                      <option key={move} value={move}>
                        {messages.samples.sizedKnightMoves[move]}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </>
          ) : (
            <CardNumberInput
              label={messages.samples.sizedNodeCountLabel}
              value={nodeCount}
              max={getSizedSampleGraphMaxNodes(sizedKind)}
              onChange={setNodeCount}
            />
          )
        ) : null}
        <button
          type="submit"
          aria-label={`${title}: ${messages.samples.sizedCreate}`}
          title={`${title} (${subtitle})`}
          className="gv-control gv-control-primary ml-auto h-8 px-[var(--app-space-3)] text-[length:var(--app-text-xs)]"
        >
          {messages.samples.sizedCreate}
        </button>
      </form>
    </div>
  );
}

function CardNumberInput({
  label,
  max = 100,
  onChange,
  value,
}: {
  label: string;
  max?: number;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="flex min-w-[76px] flex-[1_1_76px] flex-col gap-1">
      <span className="gv-section-label">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={String(max).length}
        value={value}
        aria-label={label}
        onFocus={selectInputValueOnFocus}
        onChange={(event) => {
          const nextValue = event.target.value;
          if (POSITIVE_INTEGER_INPUT_PATTERN.test(nextValue)) {
            onChange(nextValue);
          }
        }}
        className="gv-control gv-card-number-input h-8 w-full px-[var(--app-space-2)] text-[length:var(--app-text-xs)]"
      />
    </label>
  );
}

function selectInputValueOnFocus(event: FocusEvent<HTMLInputElement>) {
  const input = event.currentTarget;

  window.requestAnimationFrame(() => {
    if (document.activeElement === input) {
      input.select();
    }
  });
}

function humanizeSampleKind(kind: SampleGraphKind) {
  return kind
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .replace(/K Tree/g, "k-tree")
    .replace(/\bdag\b/i, "DAG")
    .replace(/\bscc\b/i, "SCC")
    .toLowerCase()
    .replace(/\b(dag|scc)\b/g, (match) => match.toUpperCase())
    .replace(
      /\b(petersen|paley|kneser|johnson|moser|mobius)\b/g,
      (match) => match[0].toUpperCase() + match.slice(1),
    )
    .replace(/\bk-tree\b/g, "k-tree")
    .replace(/\bx\b/g, "X")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}
