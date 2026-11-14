import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { reading } from "./reading";

/** An underlined text link; `arrow` marks a link that moves to another page. */
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
      className={cn(
        reading.link,
        arrow && "inline-flex items-center gap-1",
        className,
      )}
    >
      {children}
      {arrow ? (
        <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
      ) : null}
    </Link>
  );
}
