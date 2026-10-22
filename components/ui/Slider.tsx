"use client";

import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

import { focusRing } from "./control-styles";

/**
 * Range control with an optional set of presets. Tick marks retain their true
 * position along the track. Mobile preset buttons use a separate even row so
 * their touch targets stay apart when nearby values share a short track.
 */
export function Slider({
  compact = false,
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
  compact?: boolean;
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
    <div
      className={cn(
        "ge-slider",
        compact ? "flex min-w-0 flex-col gap-0" : "flex flex-col gap-2",
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <label
          htmlFor={name}
          className="min-w-0 text-meta font-medium [overflow-wrap:anywhere] text-[var(--muted)]"
        >
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
          <span className="pl-[3px] font-medium text-[var(--text-2)]">
            {unit}
          </span>
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
          aria-valuetext={formatValue(current, unit)}
          onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
          className="ge-range"
        />
      </div>
      {presets ? (
        <div
          className={cn(
            "relative h-8 touch:grid touch:h-auto touch:auto-cols-[minmax(0,1fr)] touch:grid-flow-col touch:gap-1",
            compact &&
              "grid h-auto auto-cols-[minmax(0,1fr)] grid-flow-col gap-1",
          )}
        >
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
                aria-label={`${label}: ${formatValue(preset, unit)}`}
                aria-pressed={current === preset}
                onClick={() => onChange(preset)}
                className={cn(
                  "h-8 rounded-md font-mono text-xs font-semibold transition-colors touch:h-11 touch:text-control",
                  focusRing,
                  compact
                    ? "min-w-0 px-1"
                    : "absolute top-0 left-[var(--ge-preset-x)] translate-x-[var(--ge-preset-shift)] px-2 touch:static touch:min-w-0 touch:translate-x-0 touch:px-1",
                  current === preset
                    ? "bg-[var(--accent-fill-soft)] text-[var(--accent-text)]"
                    : "text-[var(--text-2)] hover:bg-[var(--fill)]",
                )}
                style={
                  compact
                    ? undefined
                    : ({
                        "--ge-preset-x": `calc(${percent(r)} + (0.5 - ${r}) * var(--ge-thumb))`,
                        "--ge-preset-shift":
                          align === "start"
                            ? "calc(-1 * var(--ge-thumb) / 2)"
                            : align === "end"
                              ? "calc(-100% + var(--ge-thumb) / 2)"
                              : "-50%",
                      } as CSSProperties)
                }
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

function formatValue(value: number, unit: string) {
  return unit ? `${value} ${unit}` : String(value);
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
