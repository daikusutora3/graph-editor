import Image from "next/image";
import {
  articleScreenshotCaptions,
  articleScreenshotInterfaceNotes,
} from "@/lib/article-screenshot-content";
import type { ArticleSlug } from "@/lib/article-examples";
import type { AppLocale } from "@/lib/site-metadata";

export const articleScreenshotSections: Record<ArticleSlug, string> = {
  "edge-list": "article-import-check",
  "adjacency-matrix": "article-matrix-check",
  "tree-layout": "article-tree-root",
  "tikz-export": "article-tikz-document",
  "bipartite-graph": "article-bipartite-layout",
};

export function ArticleScreenshot({
  slug,
  locale,
}: {
  slug: ArticleSlug;
  locale: AppLocale;
}) {
  const caption = articleScreenshotCaptions[locale][slug];
  return (
    <figure className="mt-5 space-y-3">
      <Image
        unoptimized
        src={`/articles/screenshots/${slug}-mobile.jpg`}
        alt={caption}
        width={375}
        height={812}
        className="h-auto w-full rounded-xl border border-[var(--line)] sm:hidden"
      />
      <Image
        unoptimized
        src={`/articles/screenshots/${slug}.png`}
        alt={caption}
        width={853}
        height={954}
        className="hidden h-auto w-full rounded-xl border border-[var(--line)] sm:block"
      />
      <figcaption className="text-[15px] leading-7 text-[var(--text-2)]">
        {caption}
        {articleScreenshotInterfaceNotes[locale]}
      </figcaption>
    </figure>
  );
}
