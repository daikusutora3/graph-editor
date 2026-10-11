"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { controlIcon, focusRing } from "./control-styles";

/**
 * Boolean option with a full-row click target and a consistent trailing checkbox.
 */
export function OptionToggle({
  checked,
  description,
  disabled = false,
  icon,
  label,
  onChange,
}: {
  checked: boolean;
  description?: string;
  disabled?: boolean;
  icon?: ReactNode;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        disabled && "cursor-default opacity-50",
        "flex min-h-11 w-full items-center gap-3 rounded-lg px-1 text-left text-control font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--fill)]",
        focusRing,
        controlIcon,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "order-last ml-auto grid size-icon-lg shrink-0 place-items-center rounded-md border transition-colors",
          checked
            ? "border-[var(--accent)] bg-[var(--accent)] text-white"
            : "border-[var(--faint)] bg-[var(--panel-solid)]",
        )}
      >
        {checked ? <Check className="size-3" strokeWidth={1.75} /> : null}
      </span>
      {icon ? (
        <span className="grid size-icon-sm shrink-0 place-items-center text-current opacity-80">
          {icon}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-col">
        <span className="whitespace-normal">{label}</span>
        {description ? (
          <span className="text-xs font-medium text-[var(--muted)]">
            {description}
          </span>
        ) : null}
      </span>
    </button>
  );
}
