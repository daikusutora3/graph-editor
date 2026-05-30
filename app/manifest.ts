import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Graph Editor",
    short_name: "Graph Editor",
    description:
      "Create, edit, arrange, and export graph theory diagrams directly in the browser.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7fbff",
    theme_color: "#0f172a",
    icons: [
      {
        src: "/brand/graph-editor-logo-180.png",
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: "/brand/graph-editor-logo.webp",
        sizes: "512x512",
        type: "image/webp",
      },
    ],
  };
}
