import { GraphEditor } from "@/features/graph-editor/shell/GraphEditor";
import { createAppPageMetadata } from "@/lib/site-metadata";

export const metadata = createAppPageMetadata("en");

export default function EnglishHome() {
  return <GraphEditor initialLocale="en" />;
}
