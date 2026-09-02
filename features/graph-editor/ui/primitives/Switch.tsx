"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { focusRing } from "./styles";

export function SwitchIndicator({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-block h-5 w-[34px] shrink-0 rounded-full transition-colors duration-150",
        checked ? "bg-[var(--accent)]" : "bg-[var(--fill-2)]",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-4 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.2)] transition-[left] duration-150",
          checked ? "left-4" : "left-0.5",
        )}
      />
    </span>
  );
}

export function SwitchRow({
  checked,
  framed = false,
  icon,
  label,
  onClick,
}: {
  checked: boolean;
  framed?: boolean;
  icon?: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-lg pr-2.5 pl-3 text-left text-[13px] font-semibold transition-colors",
        focusRing,
        framed
          ? "h-11 border border-[var(--hair)] bg-[var(--fill)] text-[var(--text)]"
          : "min-h-10 bg-transparent text-[var(--text-2)] hover:bg-[var(--fill)]",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        {icon ? (
          <span className="grid size-[15px] shrink-0 place-items-center text-[var(--muted)]">
            {icon}
          </span>
        ) : null}
        <span className="min-w-0 truncate">{label}</span>
      </span>
      <SwitchIndicator checked={checked} />
    </button>
  );
}
