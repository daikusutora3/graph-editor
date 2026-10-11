import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { bodyText } from "./styles";
import { cn } from "@/lib/utils";

export function Callout({
  title,
  children,
  className,
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "flex min-w-0 gap-3 rounded-xl border border-[var(--line)] bg-[var(--fill)] p-4",
        className,
      )}
    >
      <Info
        className="mt-0.5 size-4 shrink-0 text-[var(--muted)]"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="text-sm leading-7 font-medium">{title}</p>
        <div className={cn("mt-1", bodyText)}>{children}</div>
      </div>
    </aside>
  );
}
