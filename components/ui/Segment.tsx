"use client";

import { cn } from "@/lib/utils";

import { segmentItem, segmentTrack } from "./control-styles";
import { rovingFocusKeyDown } from "./use-roving-focus";

type SegmentOption<T extends string> = { label: string; value: T };

export function Segment<T extends string>({
  label,
  onChange,
  options,
  size = "sm",
  value,
}: {
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
      className={cn(segmentTrack, "shrink-0")}
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            aria-label={`${label}: ${option.label}`}
            onClick={() => onChange(option.value)}
            className={cn(
              segmentItem(selected),
              size === "md" ? "min-h-8 py-1" : "min-h-7 py-0.5",
            )}
          >
            <span className="min-w-0 text-center leading-snug [overflow-wrap:anywhere] hyphens-auto whitespace-normal">
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
