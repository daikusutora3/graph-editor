"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { focusRing } from "./styles";

/**
 * Boolean option rendered as a check button, using the same selected look as
 * the segmented control (accent fill + check mark). Replaces toggle switches
 * so every "press to change state" control in a panel reads the same way.
 */
export function OptionToggle({
  checked,
  description,
  icon,
  label,
  onClick,
}: {
  checked: boolean;
  description?: string;
  icon?: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onClick}
      className={cn(
        "touch:min-h-12 flex min-h-11 w-full items-center gap-3 rounded-lg border px-3 text-left text-[13px] font-semibold shadow-[0_1px_2px_rgb(0_0_0/0.06)] transition-colors",
        focusRing,
        checked
          ? "border-[var(--accent)] bg-[var(--accent-fill-soft)] text-[var(--accent-text)]"
          : "border-[var(--line)] bg-[var(--panel-solid)] text-[var(--text-2)] hover:border-[var(--faint)] hover:text-[var(--text)]",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid size-[18px] shrink-0 place-items-center rounded-md border transition-colors",
          checked
            ? "border-[var(--accent)] bg-[var(--accent)] text-white"
            : "border-[var(--faint)] bg-[var(--panel-solid)]",
        )}
      >
        {checked ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>
      {icon ? (
        <span className="grid size-[15px] shrink-0 place-items-center text-current opacity-80">
          {icon}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-col">
        <span className="truncate">{label}</span>
        {description ? (
          <span className="text-xs font-medium text-[var(--muted)]">
            {description}
          </span>
        ) : null}
      </span>
    </button>
  );
}
