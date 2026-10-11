import { articleSlugs } from "./article-examples";
import { appArticlePaths, type AppLocale } from "./site-metadata";

export type ReadingPosition = {
  path: string;
  section?: string;
  scrollY: number;
};
export const readingReturnKey = (locale: AppLocale) =>
  `graph-editor-reading-return:${locale}`;
export const readingRestoreKey = (locale: AppLocale) =>
  `graph-editor-reading-restore:${locale}`;

export function isArticleReadingPath(path: string, locale: AppLocale) {
  return (
    path === appArticlePaths[locale] ||
    articleSlugs.some((slug) => path === `${appArticlePaths[locale]}/${slug}`)
  );
}

export function parseReadingPosition(
  value: string | null,
  locale: AppLocale,
): ReadingPosition | null {
  if (!value) return null;
  try {
    const position: unknown = JSON.parse(value);
    if (!position || typeof position !== "object") return null;
    const { path, section, scrollY } = position as Partial<ReadingPosition>;
    if (
      typeof path !== "string" ||
      !isArticleReadingPath(path, locale) ||
      typeof scrollY !== "number" ||
      !Number.isFinite(scrollY) ||
      scrollY < 0 ||
      (section !== undefined &&
        (typeof section !== "string" || !/^[a-z][a-z0-9-]*$/.test(section)))
    )
      return null;
    return { path, section, scrollY };
  } catch {
    return null;
  }
}
