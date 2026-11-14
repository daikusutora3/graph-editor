import { ArrowUpRight } from "lucide-react";
import type { AnchorHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

import { buttonClass, type ButtonSize, type ButtonVariant } from "./Button";

/**
 * A link that looks exactly like a Button. Use it for navigation (guides,
 * articles, external pages) so links and buttons never drift apart.
 * `external` opens a new tab, adds the ↗ mark, and appends `newTabLabel`
 * for screen readers.
 */
export function LinkButton({
  children,
  className,
  external = false,
  icon,
  newTabLabel,
  size = "sm",
  variant = "ghost",
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  external?: boolean;
  icon?: ReactNode;
  newTabLabel?: string;
  size?: ButtonSize;
  variant?: Extract<ButtonVariant, "ghost" | "secondary">;
}) {
  return (
    <a
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      {...props}
      className={cn(buttonClass({ size, variant }), className)}
    >
      {icon}
      {children}
      {external ? (
        <>
          <ArrowUpRight
            className="size-3 shrink-0 text-[var(--muted)]"
            aria-hidden="true"
          />
          {newTabLabel ? (
            <span className="sr-only">({newTabLabel})</span>
          ) : null}
        </>
      ) : null}
    </a>
  );
}
