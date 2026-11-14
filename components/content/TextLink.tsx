import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { reading } from "./reading";

/**
 * A link outside running text. `arrow` marks a standalone link to another
 * page; it is quieter than an inline link and ends with an arrow.
 */
export function TextLink({
  href,
  children,
  arrow = false,
  className,
}: {
  href: string;
  children: ReactNode;
  arrow?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={cn(arrow ? reading.quietLink : reading.link, className)}
    >
      {children}
      {arrow ? (
        <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
      ) : null}
    </Link>
  );
}
