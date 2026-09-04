"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

import { focusRing } from "./styles";
import { rovingFocusKeyDown } from "./use-roving-focus";

export type SegmentOption<T extends string> = { label: string; value: T };

/**
 * Segmented choice: one raised group of joined buttons. The selected option
 * is tinted with the accent fill and carries a check mark so the state reads
 * without relying on color alone.
 */
export function Segment<T extends string>({
  disabled = false,
  label,
  onChange,
  options,
  size = "sm",
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: T) => void;
  options: readonly SegmentOption<T>[];
  size?: "sm" | "md";
  value: T;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={rovingFocusKeyDown}
      className="grid min-w-0 shrink-0 auto-cols-[minmax(0,1fr)] grid-flow-col overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel-solid)] shadow-[0_1px_2px_rgb(0_0_0/0.06)]"
    >
      {options.map((option, index) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            tabIndex={selected ? 0 : -1}
            aria-label={`${label}: ${option.label}`}
            onClick={() => onChange(option.value)}
            className={cn(
              "text-control flex min-w-0 items-center justify-center gap-1.5 px-2 whitespace-nowrap transition-colors",
              "focus-visible:relative focus-visible:z-10",
              focusRing,
              size === "md" ? "min-h-9" : "min-h-[30px]",
              "touch:min-h-11",
              index > 0 && "border-l border-[var(--line)]",
              selected
                ? "bg-[var(--accent-fill-soft)] font-bold text-[var(--accent-text)]"
                : "font-semibold text-[var(--text-2)] hover:bg-[var(--fill)] hover:text-[var(--text)]",
            )}
          >
            {selected ? (
              <Check className="size-3.5 shrink-0" aria-hidden="true" />
            ) : null}
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
