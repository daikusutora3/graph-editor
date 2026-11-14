import Image from "next/image";
import { reading } from "@/components/content/reading";
import { cn } from "@/lib/utils";
import {
  articleScreenshotCaptions,
  articleScreenshotInterfaceNotes,
} from "@/lib/article-screenshot-content";
import type { ArticleSlug } from "@/lib/article-examples";
import type { AppLocale } from "@/lib/site-metadata";

export const articleScreenshotSections: Record<ArticleSlug, string> = {
  "edge-list": "article-paste",
  "tikz-export": "article-tikz-export",
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
    <figure className="@container/article-shot mt-5 space-y-2">
      <Image
        unoptimized
        src={`/articles/screenshots/${slug}-mobile.jpg`}
        alt={caption}
        width={375}
        height={812}
        className={cn(
          reading.picture,
          "mx-auto h-auto w-full max-w-[375px] @min-[40rem]/article-shot:hidden",
        )}
      />
      <Image
        unoptimized
        src={`/articles/screenshots/${slug}.png`}
        alt={caption}
        width={853}
        height={954}
        className={cn(
          reading.picture,
          "hidden h-auto w-full @min-[40rem]/article-shot:block",
        )}
      />
      <figcaption className={reading.caption}>
        {caption}
        {articleScreenshotInterfaceNotes[locale]}
      </figcaption>
    </figure>
  );
}
