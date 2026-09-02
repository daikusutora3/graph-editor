"use client";

import { CirclePlus, ClipboardList, LayoutGrid } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import type { GraphModel } from "../../core/graph/model";
import { useI18n } from "../../i18n/I18nProvider";
import { sampleGraphGroups } from "../../samples/registry";
import {
  createSampleGraph,
  type SampleGraphKind,
} from "../../samples/sample-graphs";
import { BrandLogo } from "../brand/BrandLogo";
import { focusRing } from "../primitives";

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
      <div className="ge-fade-in pointer-events-auto flex w-full max-w-[720px] flex-col items-center gap-7">
        <div className="flex flex-col items-center gap-2 text-center">
          <BrandLogo size={56} />
          <span
            translate="no"
            className="[font-family:var(--font-ui)] text-[22px] font-bold tracking-[-0.01em] text-[var(--text)]"
          >
            {messages.app.title}
          </span>
          <span className="text-[13px] leading-[1.6] text-[var(--muted)]">
            {messages.chrome.emptyTagline}
          </span>
        </div>
        <div className="flex w-full flex-wrap justify-center gap-2.5">
          <EmptyCard
            body={cards.paste.body}
            icon={<ClipboardList className="size-[17px]" aria-hidden="true" />}
            title={cards.paste.title}
            onClick={onOpenPaste}
          />
          <EmptyCard
            body={cards.sample.body}
            icon={<LayoutGrid className="size-[17px]" aria-hidden="true" />}
            title={cards.sample.title}
            onClick={onOpenSamples}
          />
          <EmptyCard
            body={cards.draw.body}
            icon={<CirclePlus className="size-[17px]" aria-hidden="true" />}
            title={cards.draw.title}
            onClick={onDraw}
          />
        </div>
        <div
          role="group"
          aria-label={messages.chrome.recentSamples}
          className="flex flex-wrap justify-center gap-2"
        >
          {recentSamples.map((sample) => (
            <button
              key={sample.kind}
              type="button"
              aria-label={messages.samples.applyAria(sample.label)}
              onClick={() => onLoadSample(sample.model)}
              className={cn(
                "ge-panel inline-flex h-[34px] items-center gap-2 rounded-full pr-3 pl-2.5 text-[12.5px] font-semibold text-[var(--text)] transition-colors hover:border-[var(--faint)]",
                focusRing,
              )}
            >
              <span
                aria-hidden="true"
                className="size-2 rounded-full border-[1.5px] border-[var(--text-2)]"
              />
              {sample.label}
              <span className="font-mono font-medium text-[var(--faint)]">
                N={sample.nodeCount}
              </span>
            </button>
          ))}
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
        "flex max-w-[224px] flex-[1_1_200px] flex-col items-start gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--panel-solid)] p-4 text-left shadow-[var(--shadow)] transition-colors hover:border-[var(--accent)] focus-visible:border-[var(--accent)]",
        focusRing,
      )}
    >
      <span className="grid size-[34px] place-items-center rounded-[9px] bg-[var(--accent-fill)] text-[var(--accent-text)]">
        {icon}
      </span>
      <span className="flex flex-col gap-[3px]">
        <span className="text-[14.5px] font-bold text-[var(--text)]">
          {title}
        </span>
        <span className="text-xs leading-[1.5] text-[var(--muted)]">
          {body}
        </span>
      </span>
    </button>
  );
}
