"use client";

import { useId, useState } from "react";

import { ControlRow, TextInput } from "@/components/ui/controls";

import { MAX_LONG_EDGE_PX } from "../io/graph-io-types";

export function PngDimensionInput({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: number) => void;
  value: number;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    const next = draft?.trim() ? Number(draft) : value;
    const normalized = Number.isFinite(next)
      ? Math.max(1, Math.min(MAX_LONG_EDGE_PX, Math.round(next)))
      : value;
    setDraft(null);
    if (normalized !== value) onChange(normalized);
  };

  return (
    <ControlRow htmlFor={id} label={label} layout="stacked">
      <div className="flex min-w-0 flex-col gap-1">
        <TextInput
          id={id}
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_LONG_EDGE_PX}
          step={1}
          value={draft ?? String(value)}
          aria-describedby={`${id}-range`}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.defaultPrevented &&
              !event.nativeEvent.isComposing &&
              event.nativeEvent.keyCode !== 229
            ) {
              event.preventDefault();
              commit();
            }
          }}
        />
        <span
          id={`${id}-range`}
          className="text-meta text-[var(--muted)] tabular-nums"
        >
          1–{MAX_LONG_EDGE_PX} px
        </span>
      </div>
    </ControlRow>
  );
}
