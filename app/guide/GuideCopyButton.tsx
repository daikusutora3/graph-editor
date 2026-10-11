"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { actionStyles } from "@/components/ui/styles";
import { cn } from "@/lib/utils";

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
        className={cn(actionStyles(), "text-xs disabled:opacity-60")}
      >
        {status === "copied" ? (
          <Check className="size-3.5 text-[var(--text)]" aria-hidden="true" />
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
