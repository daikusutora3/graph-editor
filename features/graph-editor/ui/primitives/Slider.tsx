"use client";

import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

import { focusRing } from "./styles";
import { SectionLabel } from "./Text";

export function Slider({
  label,
  max,
  min,
  name,
  onChange,
  presets,
  step,
  unit = "px",
  value,
}: {
  label: string;
  max: number;
  min: number;
  name: string;
  onChange: (value: number) => void;
  presets?: readonly number[];
  step: number;
  unit?: string;
  value: number;
}) {
  const current = snapToStep(value, { max, min, step });
  const ratio = (current - min) / (max - min);
  const fillStyle: CSSProperties = {
    width: `calc(${Math.round(ratio * 1000) / 10}% - ${Math.round((ratio - 0.5) * 16)}px)`,
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <SectionLabel>{label}</SectionLabel>
        <output
          htmlFor={name}
          className="inline-flex h-6 items-center rounded-md bg-[var(--fill)] px-2 font-mono text-xs font-semibold text-[var(--text)] tabular-nums"
        >
          {current}
          <span className="pl-[3px] text-[var(--faint)]">{unit}</span>
        </output>
      </div>
      <div className="relative flex h-5 items-center">
        <span
          aria-hidden="true"
          className="absolute inset-x-0 h-1 rounded-full bg-[var(--fill-2)]"
        />
        <span
          aria-hidden="true"
          className="absolute left-0 h-1 rounded-full bg-[var(--accent)]"
          style={fillStyle}
        />
        <input
          id={name}
          type="range"
          name={name}
          min={min}
          max={max}
          step={step}
          value={current}
          aria-label={label}
          onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
          className="ge-range"
        />
      </div>
      {presets ? (
        <div className="flex gap-1">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-pressed={current === preset}
              onClick={() => onChange(preset)}
              className={cn(
                "h-[26px] rounded-md px-2.5 font-mono text-[11.5px] font-semibold transition-colors",
                focusRing,
                current === preset
                  ? "bg-[var(--accent-fill)] text-[var(--accent-text)]"
                  : "text-[var(--muted)] hover:bg-[var(--fill)]",
              )}
            >
              {preset}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function snapToStep(
  value: number,
  { max, min, step }: { max: number; min: number; step: number },
) {
  const steps = Math.round((value - min) / step);
  return Math.min(max, Math.max(min, min + steps * step));
}
