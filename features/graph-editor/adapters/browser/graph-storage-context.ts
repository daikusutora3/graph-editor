import { isArticleSlug, type ArticleSlug } from "@/lib/article-examples";

export const GRAPH_STORAGE_KEY = "graph-editor-graph";
export const EXAMPLE_GRAPH_STORAGE_PREFIX = "graph-editor-example:";

export type GraphStorageContext =
  | { kind: "original"; key: typeof GRAPH_STORAGE_KEY }
  | { kind: "example"; key: string; slug: ArticleSlug };

export function getGraphStorageContext(): GraphStorageContext {
  const slug =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location?.search ?? "").get("example");

  return slug && isArticleSlug(slug)
    ? { kind: "example", key: `${EXAMPLE_GRAPH_STORAGE_PREFIX}${slug}`, slug }
    : { kind: "original", key: GRAPH_STORAGE_KEY };
}
