import type { ComponentPropsWithoutRef, ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { focusRing, panelSurface } from "@/components/ui/styles";
import { cn } from "@/lib/utils";

export function ContentCardGrid({
  children,
  className,
  columns = 3,
  ...props
}: ComponentPropsWithoutRef<"div"> & { columns?: 2 | 3 }) {
  return (
    <div {...props} className={cn("@container/cards min-w-0", className)}>
      <div
        className={cn(
          "grid grid-cols-1 gap-3 @min-[32rem]/cards:grid-cols-2",
          columns === 3 && "@min-[40rem]/cards:grid-cols-3",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function ContentCard({
  href,
  title,
  description,
  illustration,
  category,
  actionLabel,
  headingLevel = 3,
}: {
  href: string;
  title: string;
  description: string;
  illustration: ReactNode;
  category?: string;
  actionLabel?: string;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <Link
      href={href}
      prefetch={false}
      className={cn(
        panelSurface,
        focusRing,
        "group flex h-full flex-col p-4 text-[var(--text)] transition-colors hover:bg-[var(--fill)] active:opacity-90 motion-reduce:transition-none",
      )}
    >
      <div className="mb-3 flex items-center gap-3 @min-[40rem]/cards:flex-col @min-[40rem]/cards:items-start">
        <div className="flex h-20 w-24 shrink-0 items-center justify-center text-[var(--text-2)] @min-[40rem]/cards:h-36 @min-[40rem]/cards:w-full [&>svg]:max-h-full">
          {illustration}
        </div>
        <div className="min-w-0">
          {category ? (
            <p className="mb-1 text-xs leading-5 text-[var(--muted)]">
              {category}
            </p>
          ) : null}
          <Heading className="text-base leading-7 font-semibold">
            {title}
          </Heading>
        </div>
      </div>
      <p className="flex-1 text-sm leading-7 text-[var(--text-2)]">
        {description}
      </p>
      {actionLabel ? (
        <span className="mt-4 inline-flex min-h-11 items-center justify-between gap-2 rounded-lg bg-[var(--fill)] px-3 py-2 text-sm font-medium group-hover:bg-[var(--panel-solid)]">
          {actionLabel}
          <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
        </span>
      ) : null}
    </Link>
  );
}
