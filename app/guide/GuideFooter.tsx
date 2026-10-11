import { ArrowUp, ExternalLink } from "lucide-react";
import { GuideEditorLink } from "./GuideNavigation";
import { ActionLink } from "@/components/ui/ActionLink";
import { Card } from "@/components/ui/Card";
import { BrandLogo } from "@/features/graph-editor/ui/brand/BrandLogo";
import { guideCopy } from "@/lib/guide-content";
import { REPOSITORY_URL, type AppLocale } from "@/lib/site-metadata";

export function GuideFooter({ locale }: { locale: AppLocale }) {
  const copy = guideCopy[locale];
  return (
    <footer className="mt-10 sm:mt-14">
      <Card
        padding="lg"
        className="flex flex-col gap-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:py-8"
      >
        <div className="flex min-w-0 items-start gap-3.5">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--fill)]">
            <BrandLogo size={28} />
          </span>
          <div className="min-w-0">
            <h2 className="text-base leading-6 font-semibold tracking-tight sm:text-lg">
              {copy.footerTitle}
            </h2>
            <p className="mt-1.5 max-w-sm text-[13px] leading-6 text-[var(--text-2)]">
              {copy.footerDescription}
            </p>
          </div>
        </div>
        <GuideEditorLink locale={locale} primary />
      </Card>
      <div className="mt-6 flex flex-col gap-3 text-xs text-[var(--muted)] sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-6 sm:gap-y-2">
        <p
          className="inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-1"
          translate="no"
        >
          <span className="font-medium text-[var(--text-2)]">Graph Editor</span>
          <span>by daikusutora3</span>
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <ActionLink href="#guide-top">
            {copy.backToTop}
            <ArrowUp className="size-3.5 shrink-0" aria-hidden="true" />
          </ActionLink>
          <ActionLink href={REPOSITORY_URL} rel="noreferrer">
            <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
            {copy.githubLink}
          </ActionLink>
        </div>
      </div>
    </footer>
  );
}
