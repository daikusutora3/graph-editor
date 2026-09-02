"use client";

import { cn } from "@/lib/utils";

import { focusRing } from "./styles";

export type SegmentOption<T extends string> = { label: string; value: T };

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
      className="grid min-w-0 auto-cols-[minmax(0,1fr)] grid-flow-col gap-[3px] rounded-lg bg-[var(--fill)] p-[3px]"
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${label}: ${option.label}`}
            onClick={() => onChange(option.value)}
            className={cn(
              "grid min-w-0 place-items-center truncate rounded-md px-1.5 text-[12.5px] whitespace-nowrap transition-[background-color,color,box-shadow] duration-150",
              focusRing,
              size === "md" ? "min-h-9" : "min-h-[30px]",
              selected
                ? "bg-[var(--panel-solid)] font-[650] text-[var(--accent-text)] shadow-[0_1px_2px_rgb(0_0_0/0.08)]"
                : "font-semibold text-[var(--text-2)] hover:text-[var(--text)]",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
