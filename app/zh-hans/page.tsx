import { GraphEditor } from "@/features/graph-editor/shell/GraphEditor";
import { createAppPageMetadata } from "@/lib/site-metadata";

export const metadata = createAppPageMetadata("zh-Hans");

export default function SimplifiedChineseHome() {
  return <GraphEditor initialLocale="zh-Hans" />;
}
