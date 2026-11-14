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
  children,
  navigation = false,
}: {
  locale: AppLocale;
  target: string;
  label: string;
  className?: string;
  children?: ReactNode;
  navigation?: boolean;
}) {
  return (
    <Link
      href={`${appGuidePaths[locale]}#${target}`}
      prefetch={false}
      className={cn(actionStyles, "max-w-full", className)}
    >
      {children}
      {label}
      {!navigation && (
        <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
      )}
    </Link>
  );
}
