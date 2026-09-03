"use client";

import { useAtomValue } from "jotai";
import { Search, X } from "lucide-react";
import {
  type FocusEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

import type { GraphModel } from "../../core/graph/model";
import { useI18n } from "../../i18n/I18nProvider";
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
} from "../../samples/sample-graphs";
import {
  sampleGraphCount,
  sampleGraphGroups,
  type SampleGraphItem,
} from "../../samples/registry";
import { graphAtom } from "../../shell/state/graph-atoms";
import { useApplyGraphModel } from "../../workflows/starter/use-apply-graph-model";
import {
  Button,
  SectionLabel,
  Select,
  TextInput,
  focusRing,
} from "../primitives";
import { SampleGraphPreview } from "./SampleGraphPreview";

export const SAMPLE_GALLERY_GRID_CLASS =
  "grid grid-cols-[repeat(auto-fill,minmax(min(100%,240px),1fr))] gap-2.5";

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
          if (!query) {
            return true;
          }

          const groupCopy = messages.samples.group[group.key];
          const sampleCopy = messages.samples.item[sample.kind];
          const sampleTitle = sampleCopy?.title ?? sample.label;
          const sampleSubtitle =
            sampleCopy?.subtitle ??
            (locale === "ja"
              ? sample.subtitle
              : humanizeSampleKind(sample.kind));
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

  const applyModel = (model: GraphModel) => {
    applyGraphModel(model, {
      clearEdgeDraft: true,
      clearSelection: true,
      fitAfterUpdate: true,
      selectMode: true,
    });
    onSampleApplied();
  };
  const generateSample = (kind: SampleGraphKind) => {
    applyModel(createSampleGraph(kind, graph.settings));
  };
  const generateSizedSample = (
    kind: SizedSampleGraphKind,
    values: SizedSampleValues,
  ) => {
    const usesGridDimensions = kind === "grid" || kind === "knight";
    const nodeCount = clampSizedSampleNodeCount(
      kind,
      usesGridDimensions ? values.rows * values.columns : values.nodeCount,
    );

    applyModel(
      createSizedSampleGraph(
        kind,
        nodeCount,
        graph.settings,
        usesGridDimensions
          ? {
              columns: values.columns,
              knightMove: values.knightMove,
              rows: values.rows,
            }
          : undefined,
      ),
    );
  };

  return (
    <div className="ge-fade-in flex min-h-0 flex-1 flex-col">
      <SampleGalleryFilter
        query={sampleQuery}
        total={sampleGraphCount}
        shown={filteredSampleCount}
        onQueryChange={setSampleQuery}
      />

      <div className="ge-scrollbar flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4">
        {filteredSampleGroups.length > 0 ? (
          filteredSampleGroups.map((group) => (
            <section key={group.key} className="flex flex-col gap-2.5">
              <div className="flex items-start justify-between gap-3 px-0.5">
                <div className="flex min-w-0 flex-col gap-1">
                  <SectionLabel>
                    {messages.samples.group[group.key].label}
                  </SectionLabel>
                  <div className="text-xs leading-snug text-[var(--muted)]">
                    {messages.samples.group[group.key].note}
                  </div>
                </div>
                <div className="font-mono text-[11px] font-semibold text-[var(--muted)] tabular-nums">
                  {group.samples.length}
                </div>
              </div>
              <LazyGroup
                count={group.samples.length}
                eager={filteredSampleGroups.indexOf(group) === 0}
              >
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
              </LazyGroup>
            </section>
          ))
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel-solid)] px-5 py-8 text-center">
            <div className="text-sm font-bold text-[var(--text)]">
              {messages.samples.empty}
            </div>
            <Button variant="secondary" onClick={() => setSampleQuery("")}>
              {messages.samples.clearSearch}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Renders a group's cards only once it approaches the viewport. Sixty-plus
 * SVG previews with edge routing are too heavy to paint in one go. */
function LazyGroup({
  children,
  count,
  eager,
}: {
  children: ReactNode;
  count: number;
  eager: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [rendered, setRendered] = useState(eager);

  useEffect(() => {
    if (rendered) {
      return;
    }

    const element = ref.current;

    if (!element || typeof IntersectionObserver === "undefined") {
      setRendered(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRendered(true);
          observer.disconnect();
        }
      },
      { rootMargin: "320px 0px" },
    );
    observer.observe(element);

    return () => observer.disconnect();
  }, [rendered]);

  const rows = Math.ceil(count / 2);

  return (
    <div ref={ref} style={rendered ? undefined : { minHeight: rows * 172 }}>
      {rendered ? children : null}
    </div>
  );
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
    <div className="flex items-center gap-3 px-4 pt-3.5 pb-3">
      <label className="ge-focus touch:h-11 flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--fill)] px-3 text-[var(--muted)] focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_3px_var(--accent-ring)]">
        <Search className="size-3.5 shrink-0" aria-hidden="true" />
        <input
          type="search"
          name="sample-search"
          value={query}
          autoComplete="off"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={messages.samples.searchPlaceholder}
          aria-label={messages.samples.searchAria}
          className="h-full min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
        />
        {query ? (
          <button
            type="button"
            aria-label={messages.samples.clearSearch}
            onClick={() => onQueryChange("")}
            className={cn(
              "touch:size-9 grid size-5 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--fill-2)] hover:text-[var(--text)]",
              focusRing,
            )}
          >
            <X className="size-3" aria-hidden="true" />
          </button>
        ) : null}
      </label>
      <div className="shrink-0 font-mono text-[11px] font-semibold text-[var(--muted)] tabular-nums">
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

  return (
    <form
      noValidate
      className="flex flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel-solid)] shadow-[var(--shadow)]"
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
      <div className="grid grid-cols-[106px_minmax(0,1fr)] items-center gap-3 p-3">
        <span className="grid h-[88px] w-[106px] place-items-center overflow-hidden rounded-lg bg-[var(--bg)] [background-image:radial-gradient(circle,var(--grid)_1px,transparent_1.4px)] [background-size:12px_12px]">
          <SampleGraphPreview
            model={model}
            sampleKind={sample.kind}
            width={98}
            height={76}
          />
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-sm leading-tight font-bold break-words text-[var(--text)]">
            {title}
          </span>
          <span className="text-xs leading-snug font-medium [overflow-wrap:anywhere] text-[var(--muted)]">
            {subtitle}
          </span>
        </span>
      </div>
      <div
        className={cn(
          "flex flex-wrap gap-2 border-t border-[var(--hair)] px-3 py-2.5",
          sizedKind ? "items-end" : "items-center",
        )}
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
                <label className="flex min-w-[120px] flex-[1_1_120px] flex-col gap-1">
                  <SectionLabel>
                    {messages.samples.sizedKnightMoveLabel}
                  </SectionLabel>
                  <Select
                    value={knightMove}
                    aria-label={messages.samples.sizedKnightMoveLabel}
                    onChange={(event) =>
                      setKnightMove(event.target.value as SizedKnightMoveKind)
                    }
                  >
                    {sizedKnightMoveKinds.map((move) => (
                      <option key={move} value={move}>
                        {messages.samples.sizedKnightMoves[move]}
                      </option>
                    ))}
                  </Select>
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
        <Button
          type="submit"
          aria-label={`${title}: ${messages.samples.sizedCreate}`}
          title={`${title} (${subtitle})`}
          size="sm"
          variant="secondary"
          className="ml-auto px-3"
        >
          {messages.samples.sizedCreate}
        </Button>
      </div>
    </form>
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
    <label className="flex min-w-[68px] flex-[1_1_68px] flex-col gap-1">
      <SectionLabel>{label}</SectionLabel>
      <TextInput
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
        className="font-mono tabular-nums"
      />
    </label>
  );
}

function clampPositiveInteger(value: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.min(100, Math.round(value)));
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
