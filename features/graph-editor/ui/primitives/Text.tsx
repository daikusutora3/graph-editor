"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Kbd({
  children,
  className,
  size = "sm",
}: {
  children: ReactNode;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <kbd
      aria-hidden="true"
      className={cn(
        "grid place-items-center bg-[var(--fill)] font-mono font-semibold text-[var(--muted)]",
        size === "sm"
          ? "h-[18px] min-w-5 rounded px-1 text-[10.5px]"
          : "h-5 min-w-[22px] rounded-[5px] px-[5px] text-[13px]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function SectionLabel({
  children,
  className,
  trailing,
}: {
  children: ReactNode;
  className?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <span className="text-[11px] font-bold tracking-[0.06em] text-[var(--muted)]">
        {children}
      </span>
      {trailing ? (
        <span className="text-[11.5px] text-[var(--faint)]">{trailing}</span>
      ) : null}
    </div>
  );
}

export function Hairline({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("h-px w-full bg-[var(--hair)]", className)}
    />
  );
}

export function Notice({
  children,
  tone = "warning",
}: {
  children: ReactNode;
  tone?: "warning" | "danger" | "success";
}) {
  return (
    <div
      role="status"
      className={cn(
        "rounded-lg px-3 py-2 text-xs leading-snug font-semibold",
        tone === "warning" && "bg-[var(--warning)] text-[var(--warning-text)]",
        tone === "success" && "bg-[var(--success)] text-[var(--success-text)]",
        tone === "danger" && "bg-[var(--danger-fill)] text-[var(--danger)]",
      )}
    >
      {children}
    </div>
  );
}
