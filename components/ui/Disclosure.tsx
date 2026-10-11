import { ChevronDown } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { bodyText, insetFocusRing, panelSurface } from "./styles";
import { cn } from "@/lib/utils";

type DisclosureProps = Omit<ComponentPropsWithoutRef<"details">, "title"> & {
  /** Keep the summary free of nested links or buttons. */
  title: ReactNode;
  children: ReactNode;
};

/** Native disclosure: works with the keyboard and without client JavaScript. */
export function Disclosure({
  title,
  children,
  className,
  ...props
}: DisclosureProps) {
  return (
    <details
      {...props}
      className={cn("group/disclosure", panelSurface, className)}
    >
      <summary
        className={cn(
          "flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-4 py-3 text-sm leading-6 font-medium transition-colors group-open/disclosure:rounded-b-none group-open/disclosure:bg-[var(--fill)] hover:bg-[var(--fill)] sm:px-5 [&::-webkit-details-marker]:hidden",
          insetFocusRing,
        )}
      >
        <span className="min-w-0">{title}</span>
        <ChevronDown
          className="size-4 shrink-0 text-[var(--muted)] group-open/disclosure:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div
        className={cn(
          "rounded-b-xl border-t border-[var(--line)] px-4 py-4 sm:px-5",
          bodyText,
        )}
      >
        {children}
      </div>
    </details>
  );
}
