import type { MetadataRoute } from "next";

import {
  APP_DESCRIPTION,
  APP_ICON,
  APP_ICON_192,
  APP_NAME,
  APPLE_TOUCH_ICON,
} from "@/lib/site-metadata";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "ja",
    background_color: "#f9fafb",
    theme_color: "#111827",
    icons: [
      {
        src: APPLE_TOUCH_ICON,
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: APPLE_TOUCH_ICON,
        sizes: "180x180",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: APP_ICON_192,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: APP_ICON,
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
