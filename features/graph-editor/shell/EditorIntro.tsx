import { guideCopy } from "@/lib/guide-content";
import {
  appGuidePaths,
  appLocaleMetadata,
  type AppLocale,
} from "@/lib/site-metadata";

/** Visible, persistent content shared by the static HTML and the live editor. */
export function EditorIntro({ locale }: { locale: AppLocale }) {
  const copy = appLocaleMetadata[locale];

  return (
    <section
      aria-labelledby="editor-intro-title"
      className="shrink-0 border-t border-[var(--hair)] bg-[var(--bg)] px-4 py-2 sm:px-5"
    >
      <div className="mx-auto flex max-w-5xl items-start justify-between gap-4">
        <div className="min-w-0">
          <h1
            id="editor-intro-title"
            className="text-xs font-semibold text-[var(--text)]"
          >
            {copy.headline}
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-2)]">
            {copy.description}
          </p>
        </div>
        <a
          href={appGuidePaths[locale]}
          className="inline-flex min-h-11 shrink-0 items-center text-xs font-semibold text-[var(--accent-text)] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {guideCopy[locale].guideLink}
        </a>
      </div>
    </section>
  );
}
