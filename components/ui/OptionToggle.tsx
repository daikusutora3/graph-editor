"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { controlIcon, focusRing, pressFeedback } from "./control-styles";

export function OptionToggle({
  checked,
  icon,
  label,
  onChange,
}: {
  checked: boolean;
  icon?: ReactNode;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 rounded-lg px-1 text-left text-control font-medium text-[var(--text-2)] transition-colors enabled:hover:bg-[var(--fill)]",
        focusRing,
        pressFeedback,
        controlIcon,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "order-last ml-auto grid size-icon-lg shrink-0 place-items-center rounded-md border transition-colors",
          checked
            ? "border-[var(--accent)] bg-[var(--accent)] text-white"
            : "border-[var(--control-border)] bg-[var(--panel-solid)]",
        )}
      >
        {checked ? <Check className="size-3" strokeWidth={1.75} /> : null}
      </span>
      {icon ? (
        <span
          aria-hidden="true"
          className="grid size-icon-sm shrink-0 place-items-center text-current opacity-80"
        >
          {icon}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-col">
        <span className="whitespace-normal">{label}</span>
      </span>
    </button>
  );
}
