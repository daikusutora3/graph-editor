import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { appGuidePaths, type AppLocale } from "@/lib/site-metadata";
import { cn } from "@/lib/utils";
import { focusRing } from "@/components/ui/styles";

export function ContextGuideLink({
  locale,
  target,
  label,
  className,
  ariaCurrent,
  children,
  navigation = false,
}: {
  locale: AppLocale;
  target: string;
  label: string;
  className?: string;
  ariaCurrent?: "page";
  children?: ReactNode;
  navigation?: boolean;
}) {
  return (
    <Link
      href={`${appGuidePaths[locale]}#${target}`}
      prefetch={false}
      aria-current={ariaCurrent}
      className={cn(
        "inline-flex min-h-11 max-w-full items-center gap-2 rounded-lg py-2 text-[var(--text-2)] transition-colors hover:text-[var(--text)] active:opacity-80",
        focusRing,
        className,
      )}
    >
      {children}
      {label}
      {!navigation && (
        <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
      )}
    </Link>
  );
}
