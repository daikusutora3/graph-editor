"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

import { focusRing, rowControl } from "./control-styles";

export function ActionRow({
  active = false,
  children,
  className,
  icon,
  tone = "neutral",
  trailing,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  icon?: ReactNode;
  tone?: "neutral" | "danger";
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        rowControl,
        focusRing,
        "px-1 disabled:cursor-default disabled:text-[var(--faint)] disabled:hover:bg-transparent",
        tone === "danger" && active
          ? "text-[var(--danger)]"
          : "text-[var(--text-2)]",
        tone === "danger"
          ? cn(
              "hover:bg-[var(--danger-fill)] hover:text-[var(--danger)]",
              active && "bg-[var(--danger-fill)]",
            )
          : "hover:bg-[var(--fill)] hover:text-[var(--text)]",
        className,
      )}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span className="min-w-0 flex-1">{children}</span>
      {trailing ? (
        <span className="shrink-0 text-meta font-medium text-[var(--muted)]">
          {trailing}
        </span>
      ) : null}
    </button>
  );
}
