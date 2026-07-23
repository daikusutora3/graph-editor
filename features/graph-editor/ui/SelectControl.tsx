import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type SelectControlProps = SelectHTMLAttributes<HTMLSelectElement> & {
  containerClassName?: string;
};

export function SelectControl({
  children,
  className,
  containerClassName,
  ...props
}: SelectControlProps) {
  return (
    <span className={cn("relative block min-w-0", containerClassName)}>
      <select {...props} className={cn("gv-select-control", className)}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-[var(--text-mute)]"
        aria-hidden="true"
        strokeWidth={2}
      />
    </span>
  );
}
