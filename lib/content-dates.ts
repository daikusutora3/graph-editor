import { execFileSync } from "node:child_process";

/**
 * Build-time content dates for sitemap <lastmod> and structured data.
 *
 * Search engines compare <lastmod> against what they last crawled and skip
 * pages that claim a change on every deploy, so each page group reports the
 * commit date of the files that actually produce its content instead of the
 * build clock. Runs only in server code during `next build`.
 */
const BUILD_DATE = new Date();

/** First public release of the localized guide pages. */
export const GUIDE_PUBLISHED_DATE = "2026-09-04";

const HOME_CONTENT_PATHS = [
  "lib/site-metadata.ts",
  "features/graph-editor/shell/EditorIntro.tsx",
  "features/graph-editor/shell/GraphEditor.tsx",
  "features/graph-editor/ui",
  "features/graph-editor/i18n",
];

const GUIDE_CONTENT_PATHS = ["lib/guide-content.ts", "app/guide/GuidePage.tsx"];

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

/** YYYY-MM-DD, the form schema.org and sitemaps both accept. */
export function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
