"use client";

import {
  ArrowRight,
  ChevronDown,
  ExternalLink,
  PenTool,
  FileInput,
  Shapes,
} from "lucide-react";
import { useEffect, useMemo, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import type { GraphModel } from "../../core/graph/model";
import { useI18n } from "../../i18n/I18nProvider";
import { sampleGraphGroups } from "../../samples/registry";
import {
  createSampleGraph,
  type SampleGraphKind,
} from "../../samples/sample-graphs";
import { focusRing } from "../primitives";
import { BrandLogo } from "../brand/BrandLogo";

// Author profile destinations from the original starter screen.
const AUTHOR_LINKS = [
  { label: "YouTube", href: "https://www.youtube.com/@daikusutora-dayo" },
  { label: "X", href: "https://x.com/daikusutora3" },
  { label: "GitHub", href: "https://github.com/daikusutora3" },
] as const;

const RECENT_SAMPLE_KINDS: readonly SampleGraphKind[] = [
  "cycle",
  "tree",
  "grid",
];

export function EmptyState({
  graph,
  mobile,
  onDraw,
  onLoadSample,
  onOpenPaste,
  onOpenSamples,
}: {
  graph: GraphModel;
  mobile: boolean;
  onDraw: () => void;
  onLoadSample: (model: GraphModel) => void;
  onOpenPaste: () => void;
  onOpenSamples: () => void;
}) {
  const { messages } = useI18n();
  const authorRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      const details = authorRef.current;
      if (
        details?.open &&
        event.target instanceof Node &&
        !details.contains(event.target)
      ) {
        details.open = false;
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      const details = authorRef.current;
      if (event.key === "Escape" && details?.open) {
        details.open = false;
        details.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const recentSamples = useMemo(
    () =>
      RECENT_SAMPLE_KINDS.map((kind) => {
        const model = createSampleGraph(kind, graph.settings);
        const item = sampleGraphGroups
          .flatMap((group) => group.samples)
          .find((sample) => sample.kind === kind);
        const label = messages.samples.item[kind]?.title ?? item?.label ?? kind;

        return { kind, label, model, nodeCount: model.nodes.length };
      }),
    [graph.settings, messages.samples.item],
  );
  const cards = messages.chrome.emptyCards;

  return (
    <div
      className={
        mobile
          ? "pointer-events-none absolute inset-0 z-50 grid place-items-center px-4 pt-[72px] pb-[100px]"
          : "pointer-events-none absolute inset-0 z-50 grid place-items-center px-5 pt-20 pb-[120px]"
      }
    >
      <div className="pointer-events-auto flex max-h-full min-h-0 w-full max-w-[620px] flex-col items-center gap-6 overflow-y-auto overscroll-contain">
        <div className="flex flex-col items-center gap-1">
          <h2 className="inline-flex items-center gap-3">
            <BrandLogo size={48} />
            <span
              translate="no"
              className="text-3xl leading-tight font-semibold tracking-tight text-[var(--text)]"
            >
              {messages.app.title}
            </span>
          </h2>
          <details
            ref={authorRef}
            className="group/author relative text-left text-xs text-[var(--muted)]"
          >
            <summary className="inline-flex min-h-6 cursor-pointer list-none items-center gap-1 rounded underline-offset-4 hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
              <span>{messages.app.authorPrefix}</span>
              <span
                translate="no"
                className="underline decoration-[var(--line)] group-hover/author:decoration-current"
              >
                daikusutora3
              </span>
              <ChevronDown
                aria-hidden="true"
                className="size-3 group-open/author:rotate-180"
              />
            </summary>
            <div className="absolute top-full left-0 z-10 mt-1 flex w-40 flex-col rounded-lg border border-[var(--line)] bg-[var(--panel-solid)] p-1 shadow-[var(--shadow)]">
              {AUTHOR_LINKS.map(({ href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-10 items-center justify-between gap-3 rounded px-3 text-[var(--text-2)] hover:bg-[var(--fill)] hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {label}
                  <ExternalLink aria-hidden="true" className="size-3" />
                </a>
              ))}
            </div>
          </details>
        </div>

        <div className="grid w-full gap-2 sm:grid-cols-3">
          <EmptyCard
            body={cards.paste.body}
            icon={
              <FileInput
                className="size-6"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            }
            title={cards.paste.title}
            onClick={onOpenPaste}
          />
          <EmptyCard
            body={cards.sample.body}
            icon={
              <Shapes
                className="size-6"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            }
            title={cards.sample.title}
            onClick={onOpenSamples}
          />
          <EmptyCard
            body={cards.draw.body}
            icon={
              <PenTool
                className="size-6"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            }
            title={cards.draw.title}
            onClick={onDraw}
          />
        </div>

        <div
          role="group"
          aria-label={messages.chrome.recentSamples}
          className="flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-2"
        >
          <span className="text-xs text-[var(--muted)]">
            {messages.chrome.recentSamples}
          </span>
          <div className="flex flex-wrap justify-center gap-2">
            {recentSamples.map((sample) => (
              <button
                key={sample.kind}
                type="button"
                aria-label={messages.samples.applyAria(sample.label)}
                onClick={() => onLoadSample(sample.model)}
                className={cn(
                  "touch:h-11 text-control group inline-flex h-9 items-center gap-2 rounded-md px-2.5 font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--fill)] hover:text-[var(--text)]",
                  focusRing,
                )}
              >
                <SampleGlyph model={sample.model} />
                {sample.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyCard({
  body,
  icon,
  title,
  onClick,
}: {
  body: string;
  icon: ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex flex-row items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel-solid)] p-4 text-left transition-colors duration-150 hover:border-[var(--muted)] hover:bg-[var(--fill)] focus-visible:border-[var(--accent)] sm:min-h-[144px] sm:flex-col sm:items-start sm:gap-4",
        focusRing,
      )}
    >
      <span className="grid size-8 shrink-0 place-items-center text-[var(--text-2)] transition-colors group-hover:text-[var(--text)]">
        {icon}
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-[var(--text)]">
          {title}
        </span>
        <span className="text-xs leading-[1.55] text-[var(--muted)]">
          {body}
        </span>
      </span>
      <ArrowRight
        aria-hidden="true"
        className="absolute top-5 right-4 hidden size-4 text-[var(--muted)] transition-colors group-hover:text-[var(--text)] sm:block"
      />
    </button>
  );
}

const GLYPH_SIZE = 20;
const GLYPH_PADDING = 2.5;

/** Tiny wireframe of a sample, drawn from its laid-out node positions. */
function SampleGlyph({ model }: { model: GraphModel }) {
  const points = useMemo(() => {
    const xs = model.nodes.map((node) => node.x);
    const ys = model.nodes.map((node) => node.y);
    const minX = Math.min(...xs),
      maxX = Math.max(...xs);
    const minY = Math.min(...ys),
      maxY = Math.max(...ys);
    const span = Math.max(maxX - minX, maxY - minY, 1);
    const scale = (GLYPH_SIZE - GLYPH_PADDING * 2) / span;
    const offsetX = (GLYPH_SIZE - (maxX - minX) * scale) / 2;
    const offsetY = (GLYPH_SIZE - (maxY - minY) * scale) / 2;

    return new Map(
      model.nodes.map((node) => [
        node.id,
        {
          x: offsetX + (node.x - minX) * scale,
          y: offsetY + (node.y - minY) * scale,
        },
      ]),
    );
  }, [model]);

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${GLYPH_SIZE} ${GLYPH_SIZE}`}
      width={GLYPH_SIZE}
      height={GLYPH_SIZE}
      className="shrink-0 text-[var(--text-2)] transition-colors group-hover:text-[var(--text)]"
    >
      {model.edges.map((edge) => {
        const a = points.get(edge.source);
        const b = points.get(edge.target);
        if (!a || !b || edge.source === edge.target) return null;
        return (
          <line
            key={edge.id}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="currentColor"
            strokeWidth={1}
            strokeOpacity={0.55}
          />
        );
      })}
      {[...points].map(([id, point]) => (
        <circle
          key={id}
          cx={point.x}
          cy={point.y}
          r={1.7}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}
