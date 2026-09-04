"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Kbd({
  children,
  className,
  size = "sm",
  tone = "neutral",
}: {
  children: ReactNode;
  className?: string;
  size?: "sm" | "md";
  tone?: "neutral" | "danger" | "inherit";
}) {
  return (
    <kbd
      aria-hidden="true"
      className={cn(
        "touch:hidden grid place-items-center rounded-md font-mono font-semibold",
        size === "sm"
          ? "h-[22px] min-w-6 px-1.5 text-xs"
          : "h-7 min-w-7 px-1.5 text-sm",
        tone === "neutral" && "bg-[var(--fill)] text-[var(--muted)]",
        tone === "danger" && "bg-[var(--danger-fill)] text-[var(--danger)]",
        tone === "inherit" && "bg-[var(--fill)] text-inherit",
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
      <span className="text-meta font-bold tracking-[0.06em] text-[var(--muted)]">
        {children}
      </span>
      {trailing ? (
        <span className="text-xs font-medium text-[var(--muted)]">
          {trailing}
        </span>
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
