"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function GuideCopyButton({
  text,
  title,
  labels,
}: {
  text: string;
  title: string;
  labels: { copy: string; copySuccess: string; copyFailure: string };
}) {
  const [status, setStatus] = useState<"idle" | "busy" | "copied" | "error">(
    "idle",
  );
  const buttonLabel = status === "copied" ? labels.copySuccess : labels.copy;
  async function copy() {
    setStatus("busy");
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }
  return (
    <div className="min-w-0 text-right">
      <button
        type="button"
        onClick={copy}
        disabled={status === "busy"}
        aria-busy={status === "busy"}
        aria-label={`${buttonLabel}: ${title}`}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2.5 text-xs font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--fill-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-60"
      >
        {status === "copied" ? (
          <Check
            className="size-3.5 text-[var(--accent-text)]"
            aria-hidden="true"
          />
        ) : (
          <Copy className="size-3.5" aria-hidden="true" />
        )}
        {buttonLabel}
      </button>
      <p
        aria-live="polite"
        aria-atomic="true"
        className={
          status === "error"
            ? "mt-1 max-w-60 text-xs leading-6 text-[var(--text-2)]"
            : "sr-only"
        }
      >
        {status === "error"
          ? labels.copyFailure
          : status === "copied"
            ? labels.copySuccess
            : ""}
      </p>
    </div>
  );
}
