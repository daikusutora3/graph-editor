import type { ReactNode } from "react";
import { bodyText, readingMeasure } from "./styles";
import { cn } from "@/lib/utils";

type ContentSectionProps = {
  id?: string;
  headingId?: string;

  anchorId?: string;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  headingLevel?: 2 | 3;
  className?: string;
};

export function ContentSection({
  id,
  headingId = id ? `${id}-title` : undefined,
  anchorId,
  title,
  description,
  children,
  headingLevel = 2,
  className,
}: ContentSectionProps) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return (
    <section
      id={id}
      tabIndex={id ? -1 : undefined}
      aria-labelledby={headingId}
      className={cn(
        "min-w-0 scroll-mt-36 outline-none sm:scroll-mt-28",
        className,
      )}
    >
      {anchorId ? (
        <span
          id={anchorId}
          className="block scroll-mt-36 sm:scroll-mt-28"
          aria-hidden="true"
        />
      ) : null}
      <Heading
        id={headingId}
        tabIndex={headingId ? -1 : undefined}
        className={cn(
          "scroll-mt-36 font-semibold outline-none sm:scroll-mt-28",
          headingLevel === 3
            ? "text-sm leading-6 sm:text-base"
            : "text-xl leading-snug tracking-tight sm:text-2xl",
        )}
      >
        {title}
      </Heading>
      {description ? (
        <p className={cn("mt-3", bodyText, readingMeasure)}>{description}</p>
      ) : null}
      {children}
    </section>
  );
}
