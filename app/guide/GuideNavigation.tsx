import { ContentHeader } from "@/components/content/ContentNavigation";
import type { AppLocale } from "@/lib/site-metadata";
export { GuideContents } from "./GuideContents";

export function GuideHeader({ locale }: { locale: AppLocale }) {
  return <ContentHeader locale={locale} section="guide" />;
}
