import type { MetadataRoute } from "next";

import {
  APP_DESCRIPTION,
  APP_ICON,
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
    background_color: "#f7fbff",
    theme_color: "#0f172a",
    icons: [
      {
        src: APPLE_TOUCH_ICON,
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: APP_ICON,
        sizes: "512x512",
        type: "image/webp",
      },
    ],
  };
}
