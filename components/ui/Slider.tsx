"use client";

import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

import { fieldLabel, segmentItem, segmentTrack } from "./control-styles";

export function Slider({
  label,
  max,
  min,
  name,
  onChange,
  presets,
  step,
  value,
}: {
  label: string;
  max: number;
  min: number;
  name: string;
  onChange: (value: number) => void;
  presets?: readonly number[];
  step: number;
  value: number;
}) {
  const current = snapToStep(value, { max, min, step });
  const ratio = (current - min) / (max - min);
  const fillStyle: CSSProperties = {
    width: `calc(${percent(ratio)} + (0.5 - ${ratio}) * var(--ge-thumb))`,
  };

  return (
    <div className="ge-slider flex min-w-0 flex-col gap-0">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <label htmlFor={name} className={fieldLabel}>
          {label}
        </label>
        <output
          htmlFor={name}
          className={cn(
            "inline-flex h-6 items-center rounded-md bg-[var(--fill)] px-2 font-mono text-xs font-semibold text-[var(--text)] tabular-nums",
            "shrink-0",
          )}
        >
          {current}
          <span className="pl-[3px] font-medium text-[var(--text-2)]">px</span>
        </output>
      </div>
      <div className="relative flex h-8 items-center touch:h-11">
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
          aria-valuetext={`${current} px`}
          onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
          className="ge-range"
        />
      </div>
      {presets ? (
        <div className={segmentTrack}>
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-label={`${label}: ${preset} px`}
              aria-pressed={current === preset}
              onClick={() => onChange(preset)}
              className={cn(
                segmentItem(current === preset),
                "min-h-7 py-0.5 font-mono tabular-nums",
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

function percent(ratio: number) {
  return `${Math.round(ratio * 1000) / 10}%`;
}

function snapToStep(
  value: number,
  { max, min, step }: { max: number; min: number; step: number },
) {
  const steps = Math.round((value - min) / step);
  return Math.min(max, Math.max(min, min + steps * step));
}
