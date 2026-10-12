import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { appGuidePaths, type AppLocale } from "@/lib/site-metadata";
import { cn } from "@/lib/utils";
import { actionStyles } from "@/components/ui/styles";

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
      className={cn(actionStyles(), "max-w-full", className)}
    >
      {children}
      {label}
      {!navigation && (
        <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
      )}
    </Link>
  );
}
