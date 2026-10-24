import type { ComponentPropsWithoutRef } from "react";
import { actionStyles } from "./styles";
import { cn } from "@/lib/utils";

export function ActionLink({
  className,
  variant = "quiet",
  ...props
}: ComponentPropsWithoutRef<"a"> & {
  variant?: Parameters<typeof actionStyles>[0];
}) {
  return <a {...props} className={cn(actionStyles(variant), className)} />;
}
