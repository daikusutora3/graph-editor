"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

import { focusRing } from "./control-styles";
import { rovingFocusKeyDown } from "./use-roving-focus";

export type SegmentOption<T extends string> = { label: string; value: T };

/**
 * Mutually exclusive choices share a quiet surface and one keyboard tab stop.
 * Long translated options can wrap without changing the radio interaction.
 */
export function Segment<T extends string>({
  disabled = false,
  label,
  onChange,
  options,
  size = "sm",
  value,
  wrap = false,
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: T) => void;
  options: readonly SegmentOption<T>[];
  size?: "sm" | "md";
  value: T;
  wrap?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={rovingFocusKeyDown}
      className="grid min-w-0 shrink-0 auto-cols-[minmax(0,1fr)] grid-flow-col gap-0.5 rounded-xl bg-[var(--fill)] p-0.5"
    >
      {options.map((option) => {
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
              "flex min-w-0 items-center justify-center gap-0.5 rounded-lg px-0.5 py-1 text-control transition-colors disabled:cursor-default disabled:opacity-50",
              "focus-visible:relative focus-visible:z-10",
              focusRing,
              size === "md" ? "min-h-9" : "min-h-[30px]",
              "touch:min-h-11",
              selected
                ? "bg-[var(--panel-solid)] font-semibold text-[var(--text)]"
                : "font-medium text-[var(--muted)] hover:text-[var(--text)]",
            )}
          >
            {selected ? (
              <Check
                className="size-3 shrink-0 text-[var(--accent-text)]"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            ) : null}
            <span
              className={cn(
                "min-w-0 text-center leading-snug",
                wrap
                  ? "[overflow-wrap:anywhere] whitespace-normal"
                  : "whitespace-nowrap",
              )}
            >
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
