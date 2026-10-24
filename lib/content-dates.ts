import { execFileSync } from "node:child_process";

const BUILD_DATE = new Date();

export const GUIDE_PUBLISHED_DATE = "2026-09-04";
export const ARTICLES_PUBLISHED_DATE = "2026-10-11";

const HOME_CONTENT_PATHS = [
  "lib/site-metadata.ts",
  "features/graph-editor/shell/GraphEditor.tsx",
  "features/graph-editor/ui",
  "features/graph-editor/i18n",
];

const GUIDE_CONTENT_PATHS = [
  "lib/guide-content.ts",
  "lib/guide-examples.ts",
  "app/guide",
  "public/guide",
];

function lastCommitDate(paths: string[]): Date {
  try {
    const stdout = execFileSync(
      "git",
      ["log", "-1", "--format=%cI", "--", ...paths],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    const date = new Date(stdout);

    return Number.isNaN(date.getTime()) ? BUILD_DATE : date;
  } catch {
    return BUILD_DATE;
  }
}

export const HOME_LAST_MODIFIED = lastCommitDate(HOME_CONTENT_PATHS);
export const GUIDE_LAST_MODIFIED = lastCommitDate(GUIDE_CONTENT_PATHS);
export const ARTICLES_LAST_MODIFIED = lastCommitDate([
  "lib/article-content.ts",
  "lib/article-examples.ts",
  "app/articles",
  "components/content",
]);

export function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
