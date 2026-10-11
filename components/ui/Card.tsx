import type { ComponentPropsWithoutRef } from "react";
import { panelSurface } from "./styles";
import { cn } from "@/lib/utils";

export function Card({
  className,
  padding = "md",
  ...props
}: ComponentPropsWithoutRef<"div"> & { padding?: "md" | "lg" }) {
  return (
    <div
      {...props}
      className={cn(
        panelSurface,
        padding === "lg" ? "p-5 sm:p-6" : "p-4",
        className,
      )}
    />
  );
}
