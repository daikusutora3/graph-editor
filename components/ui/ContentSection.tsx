import type { ReactNode } from "react";
import { bodyText, panelSurface } from "./styles";
import { cn } from "@/lib/utils";

const sectionVariants = {
  plain: "",
  divided: "border-t border-[var(--line)] pt-8",
  card: cn(panelSurface, "p-4 sm:p-5"),
};

type ContentSectionProps = {
  id?: string;
  headingId?: string;
  /** Older published links can keep pointing to the same heading. */
  anchorId?: string;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  headingLevel?: 2 | 3;
  variant?: keyof typeof sectionVariants;
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
  variant = "divided",
  className,
}: ContentSectionProps) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn(
        "min-w-0 scroll-mt-24",
        sectionVariants[variant],
        className,
      )}
    >
      {anchorId ? (
        <span id={anchorId} className="block scroll-mt-24" aria-hidden="true" />
      ) : null}
      <Heading
        id={headingId}
        className={cn(
          "scroll-mt-24 font-semibold",
          headingLevel === 3
            ? "text-sm leading-6 sm:text-base"
            : "text-xl leading-snug tracking-tight sm:text-2xl",
        )}
      >
        {title}
      </Heading>
      {description ? (
        <p className={cn("mt-3", bodyText)}>{description}</p>
      ) : null}
      {children}
    </section>
  );
}
