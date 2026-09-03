"use client";

import { ChevronDown } from "lucide-react";
import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const fieldBase =
  "ge-focus h-8 w-full min-w-0 rounded-lg touch:h-11 touch:text-sm border border-[var(--line)] bg-[var(--fill)] px-2.5 text-[13px] font-semibold text-[var(--text)] outline-none placeholder:text-[var(--muted)]";

export function Select({
  children,
  className,
  containerClassName,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { containerClassName?: string }) {
  return (
    <span className={cn("relative block min-w-0", containerClassName)}>
      <select
        {...props}
        className={cn(fieldBase, "appearance-none pr-8", className)}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-[var(--muted)]"
        aria-hidden="true"
      />
    </span>
  );
}

export function TextInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(fieldBase, className)} />;
}

export function fieldClassName(extra?: string) {
  return cn(fieldBase, extra);
}
