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
        "grid min-w-0 grid-cols-[1rem_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-xl border border-[var(--line)] bg-[var(--fill)] p-4",
        className,
      )}
    >
      <Info className="mt-1.5 size-4 text-[var(--muted)]" aria-hidden="true" />
      <p className="min-w-0 text-sm leading-7 font-medium">{title}</p>
      <div
        className={cn(
          "col-span-2 min-w-0 sm:col-span-1 sm:col-start-2",
          bodyText,
        )}
      >
        {children}
      </div>
    </aside>
  );
}
