import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site-metadata";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    // Every crawler, including AI search bots, may index the app: the pages
    // are public and the graph data never leaves the browser.
    rules: [
      {
        userAgent: "*",
        allow: "/",
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
