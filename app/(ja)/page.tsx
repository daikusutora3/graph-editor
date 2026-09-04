import { EditorIntro } from "@/features/graph-editor/shell/EditorIntro";
import { GraphEditor } from "@/features/graph-editor/shell/GraphEditor";
import { createAppPageMetadata } from "@/lib/site-metadata";

export const metadata = createAppPageMetadata("ja");

export default function Home() {
  return <GraphEditor initialLocale="ja" intro={<EditorIntro locale="ja" />} />;
}
