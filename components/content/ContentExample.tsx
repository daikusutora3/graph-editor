import type { ReactNode } from "react";
import { figureCaption } from "@/components/ui/styles";
import { cn } from "@/lib/utils";
import { ContentCopyButton } from "./ContentCopyButton";

export function ContentExample({
  input,
  title,
  labels,
  children,
  caption,
}: {
  input: string;
  title: string;
  labels: {
    input: string;
    result: string;
    copy: string;
    copySuccess: string;
    copyFailure: string;
  };
  children: ReactNode;
  caption?: string;
}) {
  return (
    <div className="mt-4 grid min-w-0 overflow-hidden rounded-xl border border-[var(--line)] @min-[32rem]/reading:grid-cols-2">
      <div className="min-w-0 bg-[var(--fill)] px-4 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 py-2">
          <p className="text-sm font-medium text-[var(--muted)]">
            {labels.input}
          </p>
          <ContentCopyButton text={input} title={title} labels={labels} />
        </div>
        <pre
          className="min-w-0 overflow-x-auto font-mono text-sm leading-7 text-[var(--text)]"
          translate="no"
        >
          <code>{input}</code>
        </pre>
      </div>
      <figure className="min-w-0 border-t border-[var(--line)] bg-[var(--panel-solid)] p-4 @min-[32rem]/reading:border-t-0 @min-[32rem]/reading:border-l">
        <p className="text-sm font-medium text-[var(--muted)]">
          {labels.result}
        </p>
        <div className="mt-3 flex items-center justify-center">{children}</div>
        {caption ? (
          <figcaption className={cn("mt-3", figureCaption)}>
            {caption}
          </figcaption>
        ) : null}
      </figure>
    </div>
  );
}
