import { ChevronDown } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { bodyText, insetFocusRing, panelSurface } from "./styles";
import { cn } from "@/lib/utils";
import styles from "./Disclosure.module.css";

type DisclosureProps = Omit<ComponentPropsWithoutRef<"details">, "title"> & {
  /** Keep the summary free of nested links or buttons. */
  title: ReactNode;
  children: ReactNode;
  variant?: "panel" | "row";
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
        "group/disclosure",
        styles.disclosure,
        variant === "panel" ? panelSurface : "min-w-0",
        className,
      )}
    >
      <summary
        className={cn(
          "flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-sm leading-6 font-medium transition-colors duration-150 group-open/disclosure:bg-[var(--fill)] hover:bg-[var(--fill)] motion-reduce:transition-none sm:px-5 [&::-webkit-details-marker]:hidden",
          variant === "panel" &&
            "rounded-xl group-open/disclosure:rounded-b-none",
          insetFocusRing,
        )}
      >
        <span className="min-w-0">{title}</span>
        <ChevronDown
          className="size-4 shrink-0 text-[var(--muted)] transition-transform duration-200 ease-out group-open/disclosure:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </summary>
      <div
        className={cn(
          "border-t border-[var(--line)] px-4 py-4 sm:px-5",
          variant === "panel" && "rounded-b-xl",
          bodyText,
        )}
      >
        {children}
      </div>
    </details>
  );
}
