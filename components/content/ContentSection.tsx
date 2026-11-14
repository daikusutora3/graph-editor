import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { reading } from "./reading";

/** Running text where `backticks` mark code, as written in the content files. */
export function InlineText({ text }: { text: string }) {
  let offset = 0;
  return text.split("`").map((part, position) => {
    const key = offset;
    offset += part.length + 1;
    return position % 2 === 1 ? (
      <code key={key} className={reading.inlineCode} translate="no">
        {part}
      </code>
    ) : (
      <Fragment key={key}>{part}</Fragment>
    );
  });
}

/**
 * A titled section of a reading page. `id` makes it a contents target; the
 * page-level stylesheet keeps targets clear of the sticky header.
 */
export function ContentSection({
  id,
  headingId = id ? `${id}-title` : undefined,
  anchorId,
  title,
  action,
  description,
  children,
  headingLevel = 2,
  className,
}: {
  id?: string;
  headingId?: string;
  /** An extra anchor kept for old links to this section. */
  anchorId?: string;
  title: ReactNode;
  /** A short link beside the heading ("All articles →"). */
  action?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  headingLevel?: 2 | 3;
  className?: string;
}) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return (
    <section
      id={id}
      tabIndex={id ? -1 : undefined}
      aria-labelledby={headingId}
      className={cn("min-w-0 outline-none", className)}
    >
      {anchorId ? (
        <span id={anchorId} className="block" aria-hidden="true" />
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-x-4">
        <Heading
          id={headingId}
          tabIndex={headingId ? -1 : undefined}
          className={cn(
            "outline-none",
            headingLevel === 3 ? reading.subheading : reading.heading,
          )}
        >
          {title}
        </Heading>
        {action}
      </div>
      {description ? (
        <p className={cn("mt-3", reading.body)}>{description}</p>
      ) : null}
      {children}
    </section>
  );
}
