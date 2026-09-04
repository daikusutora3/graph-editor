import { guideCopy } from "@/lib/guide-content";
import {
  appGuidePaths,
  appLocaleMetadata,
  type AppLocale,
} from "@/lib/site-metadata";

/**
 * Static intro rendered into the exported HTML. It is what crawlers index
 * and what people see for the instant before the editor mounts; the client
 * replaces it with the live canvas once local storage has been read.
 */
export function EditorIntro({ locale }: { locale: AppLocale }) {
  const copy = appLocaleMetadata[locale];

  return (
    <section
      aria-labelledby="editor-intro-title"
      className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center gap-5 px-6 text-center"
    >
      <h1
        id="editor-intro-title"
        className="text-2xl font-bold tracking-tight text-[var(--text)]"
      >
        {copy.headline}
      </h1>
      <p className="text-sm leading-relaxed text-[var(--text-2)]">
        {copy.tagline}
      </p>
      <p className="text-sm">
        <a
          href={appGuidePaths[locale]}
          className="font-semibold text-[var(--accent-text)] underline-offset-4 hover:underline"
        >
          {guideCopy[locale].heading}
        </a>
      </p>
      <ul className="grid gap-2 text-left text-sm text-[var(--muted)] sm:grid-cols-2">
        {copy.features.map((feature) => (
          <li key={feature} className="flex gap-2">
            <span aria-hidden="true">•</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
