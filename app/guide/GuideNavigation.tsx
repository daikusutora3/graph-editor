import {
  ContentEditorLink,
  ContentHeader,
} from "@/components/content/ContentNavigation";
import type { AppLocale } from "@/lib/site-metadata";
export { GuideContents } from "./GuideContents";

export function GuideHeader({ locale }: { locale: AppLocale }) {
  return <ContentHeader locale={locale} section="guide" />;
}

export function GuideEditorLink({
  locale,
  primary = false,
}: {
  locale: AppLocale;
  primary?: boolean;
}) {
  return <ContentEditorLink locale={locale} primary={primary} />;
}
