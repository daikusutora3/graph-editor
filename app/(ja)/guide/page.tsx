import { GuidePage } from "@/app/guide/GuidePage";
import { guideCopy } from "@/lib/guide-content";
import { createGuidePageMetadata } from "@/lib/site-metadata";

export const metadata = createGuidePageMetadata("ja", guideCopy.ja);

export default function JapaneseGuide() {
  return <GuidePage locale="ja" />;
}
