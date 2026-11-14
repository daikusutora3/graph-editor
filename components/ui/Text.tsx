"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Kbd({
  children,
  size = "sm",
  tone = "neutral",
}: {
  children: ReactNode;
  size?: "sm" | "md";
  tone?: "neutral" | "danger";
}) {
  return (
    <kbd
      aria-hidden="true"
      className={cn(
        "grid place-items-center rounded-md font-mono font-semibold touch:hidden",
        size === "sm"
          ? "h-[22px] min-w-6 px-1.5 text-xs"
          : "h-7 min-w-7 px-1.5 text-sm",
        tone === "neutral" && "bg-[var(--fill)] text-[var(--muted)]",
        tone === "danger" && "bg-[var(--danger-fill)] text-[var(--danger)]",
      )}
    >
      {children}
    </kbd>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-center justify-between gap-3">
      <span className="min-w-0 text-meta font-medium [overflow-wrap:anywhere] text-[var(--muted)]">
        {children}
      </span>
    </span>
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

export function Notice({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className={cn(
        "rounded-lg px-3 py-2 text-xs leading-snug font-semibold",
        "bg-[var(--warning)] text-[var(--warning-text)]",
      )}
    >
      {children}
    </div>
  );
}
