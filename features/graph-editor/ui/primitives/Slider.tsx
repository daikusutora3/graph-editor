"use client";

import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

import { focusRing } from "./styles";
import { SectionLabel } from "./Text";

/**
 * Range control with an optional set of presets. Presets are drawn at their
 * true position along the track (with tick marks) so the thumb always sits
 * directly above the value it represents.
 */
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
    width: `calc(${percent(ratio)} + (0.5 - ${ratio}) * var(--ge-thumb))`,
  };

  return (
    <div className="ge-slider flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <SectionLabel>{label}</SectionLabel>
        <output
          htmlFor={name}
          className="inline-flex h-6 items-center rounded-md bg-[var(--fill)] px-2 font-mono text-xs font-semibold text-[var(--text)] tabular-nums"
        >
          {current}
          <span className="pl-[3px] font-medium text-[var(--text-2)]">
            {unit}
          </span>
        </output>
      </div>
      <div className="touch:h-11 relative flex h-8 items-center">
        <span
          aria-hidden="true"
          className="absolute inset-x-0 h-1 rounded-full bg-[var(--fill-2)]"
        />
        <span
          aria-hidden="true"
          className="absolute left-0 h-1 rounded-full bg-[var(--accent)]"
          style={fillStyle}
        />
        {presets?.map((preset) => (
          <span
            key={preset}
            aria-hidden="true"
            className="absolute h-2.5 w-0.5 rounded-full bg-[var(--panel-solid)] shadow-[0_0_0_1px_var(--fill-2)]"
            style={{
              left: `calc(${percent(toRatio(preset, min, max))} + (0.5 - ${toRatio(preset, min, max)}) * var(--ge-thumb))`,
              transform: "translateX(-50%)",
            }}
          />
        ))}
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
        <div className="touch:h-11 relative h-8">
          {presets.map((preset, index) => {
            const r = toRatio(preset, min, max);
            const align =
              index === 0 && r < 0.12
                ? "start"
                : index === presets.length - 1 && r > 0.88
                  ? "end"
                  : "center";

            return (
              <button
                key={preset}
                type="button"
                aria-pressed={current === preset}
                onClick={() => onChange(preset)}
                className={cn(
                  "touch:h-11 touch:px-3 touch:text-[13px] absolute top-0 h-8 rounded-md px-2 font-mono text-xs font-semibold transition-colors",
                  focusRing,
                  current === preset
                    ? "bg-[var(--accent-fill-soft)] text-[var(--accent-text)]"
                    : "text-[var(--text-2)] hover:bg-[var(--fill)]",
                )}
                style={{
                  left: `calc(${percent(r)} + (0.5 - ${r}) * var(--ge-thumb))`,
                  transform:
                    align === "start"
                      ? "translateX(calc(-1 * var(--ge-thumb) / 2))"
                      : align === "end"
                        ? "translateX(calc(-100% + var(--ge-thumb) / 2))"
                        : "translateX(-50%)",
                }}
              >
                {preset}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function toRatio(value: number, min: number, max: number) {
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
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
