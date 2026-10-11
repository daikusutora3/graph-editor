import { ChevronDown } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { bodyText, insetFocusRing, panelSurface } from "./styles";
import { cn } from "@/lib/utils";
import styles from "./Disclosure.module.css";

type DisclosureProps = Omit<ComponentPropsWithoutRef<"details">, "title"> & {
  /** Keep the summary free of nested links or buttons. */
  title: ReactNode;
  children: ReactNode;
  variant?: "panel" | "row" | "compact";
};

/** Native disclosure: works with the keyboard and without client JavaScript. */
export function Disclosure({
  title,
  children,
  className,
  variant = "panel",
  ...props
}: DisclosureProps) {
  return (
    <details
      {...props}
      className={cn(
        styles.disclosure,
        variant === "row" ? "min-w-0" : panelSurface,
        className,
      )}
    >
      <summary
        className={cn(
          styles.summary,
          "flex cursor-pointer list-none items-center justify-between text-sm leading-6 font-medium transition-colors duration-150 hover:bg-[var(--fill)] motion-reduce:transition-none [&::-webkit-details-marker]:hidden",
          variant !== "row" && "rounded-xl",
          variant === "compact"
            ? "min-h-12 gap-3 px-4 py-2.5 text-[var(--text-2)]"
            : "min-h-14 gap-4 px-4 py-3 sm:px-5",
          insetFocusRing,
        )}
      >
        <span className="min-w-0">{title}</span>
        <ChevronDown
          className={cn(
            styles.chevron,
            "size-4 shrink-0 text-[var(--muted)] transition-transform duration-200 ease-out motion-reduce:transition-none",
          )}
          aria-hidden="true"
        />
      </summary>
      <div
        className={cn(
          "border-t py-4 [&>*]:max-w-[42rem] [&>:first-child]:mt-0",
          variant !== "row" && "rounded-b-xl",
          variant === "compact"
            ? "border-[var(--hair)] px-4"
            : "border-[var(--line)] px-4 sm:px-5",
          bodyText,
        )}
      >
        {children}
      </div>
    </details>
  );
}
