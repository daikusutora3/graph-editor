import type { ComponentPropsWithoutRef } from "react";
import { actionStyles } from "./styles";
import { cn } from "@/lib/utils";

export function ActionLink({
  className,
  ...props
}: ComponentPropsWithoutRef<"a">) {
  return <a {...props} className={cn(actionStyles, className)} />;
}
