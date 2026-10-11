"use client";

import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

import { useI18n } from "../../i18n/I18nProvider";
import { focusRing } from "@/components/ui/controls";
import { BrandLogo } from "../brand/BrandLogo";
import {
  EmptyStateIllustration,
  type StartMethod,
} from "./EmptyStateIllustration";

import { EmptyStateFooter } from "./EmptyStateFooter";

export function EmptyState({
  mobile,
  onDraw,
  onOpenPaste,
  onOpenSamples,
}: {
  mobile: boolean;
  onDraw: () => void;
  onOpenPaste: () => void;
  onOpenSamples: () => void;
}) {
  const { messages } = useI18n();
  const cards = messages.chrome.emptyCards;

  return (
    <div
      className={
        mobile
          ? "pointer-events-none absolute inset-0 z-50 grid place-items-center px-4 pt-[72px] pb-[calc(var(--ge-mobile-controls-bottom,92px)+8px)]"
          : "pointer-events-none absolute inset-0 z-50 grid place-items-center px-5 pt-20 pb-[120px]"
      }
    >
      <div className="pointer-events-auto flex max-h-full min-h-0 w-full max-w-[640px] flex-col items-center gap-3 sm:gap-4">
        <div className="flex min-h-0 w-full flex-col items-center gap-3 overflow-y-auto overscroll-contain p-1 sm:gap-5">
          <div className="flex shrink-0 items-center gap-2 [@media(max-height:480px)]:hidden">
            <BrandLogo size={28} />
            <span
              translate="no"
              className="text-lg font-semibold tracking-tight text-[var(--text)]"
            >
              {messages.app.title}
            </span>
          </div>

          <div className="grid w-full shrink-0 gap-3 sm:grid-cols-3">
            <EmptyCard
              body={cards.paste.body}
              method="paste"
              title={cards.paste.title}
              onClick={onOpenPaste}
            />
            <EmptyCard
              body={cards.sample.body}
              method="sample"
              title={cards.sample.title}
              onClick={onOpenSamples}
            />
            <EmptyCard
              body={cards.draw.body}
              method="draw"
              title={cards.draw.title}
              onClick={onDraw}
            />
          </div>
        </div>

        <EmptyStateFooter mobile={mobile} />
      </div>
    </div>
  );
}

function EmptyCard({
  body,
  method,
  title,
  onClick,
}: {
  body: string;
  method: StartMethod;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex min-w-0 items-center overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel-solid)] text-left transition-colors duration-150 hover:border-[var(--accent)] focus-visible:border-[var(--accent)] sm:flex-col sm:items-stretch",
        focusRing,
      )}
    >
      <span className="pointer-events-none flex h-24 w-24 shrink-0 items-center justify-center border-r border-[var(--line)] bg-[var(--fill)] p-2.5 text-[var(--text-2)] sm:h-32 sm:w-full sm:border-r-0 sm:border-b sm:p-3 [@media(max-height:480px)]:h-20">
        <EmptyStateIllustration method={method} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5 px-3 py-4 sm:px-4">
        <span className="flex items-center justify-between gap-2 text-[13px] font-semibold text-[var(--text)] sm:text-sm">
          <span>{title}</span>
          <ArrowRight
            aria-hidden="true"
            className="size-3.5 shrink-0 text-[var(--muted)] transition-colors group-hover:text-[var(--accent)]"
          />
        </span>
        <span className="text-xs leading-relaxed text-[var(--muted)]">
          {body}
        </span>
      </span>
    </button>
  );
}
