import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { SectionLabel } from "./Text";

/** A panel section owns its heading and spacing; controls own their names. */
export function ControlGroup({
  children,
  className,
  label,
  spacing = "normal",
}: {
  children: ReactNode;
  className?: string;
  label?: string;
  spacing?: "normal" | "tight";
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col",
        spacing === "tight" ? "gap-0" : "gap-2",
        className,
      )}
    >
      {label ? <SectionLabel>{label}</SectionLabel> : null}
      {children}
    </div>
  );
}

/** Short labels sit beside controls; longer labels keep the full control width. */
export function ControlRow({
  children,
  className,
  htmlFor,
  label,
  layout = "inline",
}: {
  children: ReactNode;
  className?: string;
  htmlFor?: string;
  label: string;
  layout?: "inline" | "stacked";
}) {
  const Label = htmlFor ? "label" : "span";
  return (
    <div
      className={cn(
        "grid min-w-0 gap-2",
        layout === "inline"
          ? "grid-cols-[4rem_minmax(0,1fr)] items-center"
          : "grid-cols-1",
        className,
      )}
    >
      <Label
        htmlFor={htmlFor}
        className="min-w-0 text-control font-medium [overflow-wrap:anywhere] text-[var(--muted)]"
      >
        {label}
      </Label>
      {children}
    </div>
  );
}

/** Equal-width actions keep their text and touch targets inside narrow panels. */
export function PanelActions({ children }: { children: ReactNode }) {
  return (
    <div className="grid w-full min-w-0 auto-cols-[minmax(0,1fr)] grid-flow-col gap-2">
      {children}
    </div>
  );
}
