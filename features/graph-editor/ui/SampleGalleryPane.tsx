"use client";

import { useAtomValue } from "jotai";
import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

import type { GraphModel } from "../core/graph/model";
import { useI18n } from "../i18n/I18nProvider";
import {
  createSampleGraph,
  createSizedSampleGraph,
  SIZED_SAMPLE_GRAPH_MAX_NODES,
  SIZED_SAMPLE_GRAPH_MIN_NODES,
  sizedSampleGraphKinds,
  type SampleGraphKind,
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

export function SampleGalleryPane({ onSampleApplied }: SampleGalleryPaneProps) {
  const graph = useAtomValue(graphAtom);
  const { locale, messages } = useI18n();
  const applyGraphModel = useApplyGraphModel();
  const [sampleQuery, setSampleQuery] = useState("");
  const [sizedKind, setSizedKind] = useState<SizedSampleGraphKind>("path");
  const [sizedNodeCount, setSizedNodeCount] = useState("8");
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
  const generateSizedSample = () => {
    const parsedNodeCount = Number(sizedNodeCount);
    const model = createSizedSampleGraph(
      sizedKind,
      parsedNodeCount,
      graph.settings,
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
      <form
        className="flex flex-wrap items-end gap-[var(--app-space-2)] px-[var(--app-space-3)] pt-[var(--app-space-2)] pb-[var(--app-space-1)]"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          generateSizedSample();
        }}
      >
        <label className="flex min-w-[150px] flex-[1_1_160px] flex-col gap-1">
          <span className="gv-section-label">
            {messages.samples.sizedKindLabel}
          </span>
          <select
            value={sizedKind}
            onChange={(event) =>
              setSizedKind(event.target.value as SizedSampleGraphKind)
            }
            className="gv-control h-9 w-full px-[var(--app-space-3)] text-[length:var(--app-text-sm)]"
          >
            {sizedSampleGraphKinds.map((kind) => {
              const sample = messages.samples.item[kind];
              const fallback = humanizeSampleKind(kind);
              return (
                <option key={kind} value={kind}>
                  {sample?.title ?? fallback}
                </option>
              );
            })}
          </select>
        </label>
        <label className="flex w-[112px] flex-col gap-1">
          <span className="gv-section-label">
            {messages.samples.sizedNodeCountLabel}
          </span>
          <input
            type="number"
            min={SIZED_SAMPLE_GRAPH_MIN_NODES}
            max={SIZED_SAMPLE_GRAPH_MAX_NODES}
            step={1}
            value={sizedNodeCount}
            aria-label={messages.samples.sizedNodeCountAria}
            onChange={(event) => setSizedNodeCount(event.target.value)}
            className="gv-control h-9 w-full px-[var(--app-space-3)] text-[length:var(--app-text-sm)]"
          />
        </label>
        <button
          type="submit"
          className="gv-control h-9 px-[var(--app-space-4)] text-[length:var(--app-text-sm)]"
        >
          {messages.samples.sizedCreate}
        </button>
      </form>
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
}: {
  sample: SampleGraphItem;
  settings: GraphModel["settings"];
  onApply: () => void;
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

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--app-radius-md)] border border-transparent bg-[var(--bg-deep)] transition-colors hover:bg-[var(--state-hover-bg)]",
      )}
    >
      <button
        type="button"
        onClick={onApply}
        aria-label={messages.samples.applyAria(title)}
        title={`${title} (${subtitle})`}
        className={cn(
          SAMPLE_CARD_LAYOUT_CLASS,
          "w-full text-left focus-visible:ring-2 focus-visible:ring-[var(--state-focus-ring)] focus-visible:outline-none",
        )}
      >
        <span className={cn(SAMPLE_PREVIEW_FRAME_CLASS, "bg-[var(--surface)]")}>
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
      </button>
    </div>
  );
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
