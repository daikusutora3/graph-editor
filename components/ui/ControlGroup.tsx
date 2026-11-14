import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { fieldLabel } from "./control-styles";
import { SectionLabel } from "./Text";

export function ControlGroup({
  children,
  label,
  spacing = "normal",
}: {
  children: ReactNode;
  label?: string;
  spacing?: "normal" | "tight";
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col",
        spacing === "tight" ? "gap-0" : "gap-2",
      )}
    >
      {label ? <SectionLabel>{label}</SectionLabel> : null}
      {children}
    </div>
  );
}

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
        "grid min-w-0",
        layout === "inline"
          ? "grid-cols-[4rem_minmax(0,1fr)] items-center gap-2"
          : "grid-cols-1 gap-1",
        className,
      )}
    >
      <Label htmlFor={htmlFor} className={fieldLabel}>
        {label}
      </Label>
      {children}
    </div>
  );
}

export function PanelActions({ children }: { children: ReactNode }) {
  return (
    <div className="grid w-full min-w-0 auto-cols-[minmax(0,1fr)] grid-flow-col gap-2">
      {children}
    </div>
  );
}
