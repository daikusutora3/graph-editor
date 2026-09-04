import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Fills the CSP script hashes in out/_headers after `next build`.
 *
 * The static export inlines React Server Component payloads as small
 * <script> blocks whose content changes every build, so a nonce is impossible
 * and a hand-written hash list would rot. Hashing every inline script in the
 * exported HTML keeps `script-src` strict without 'unsafe-inline'.
 */
const OUT_DIR = "out";
const PLACEHOLDER = "__INLINE_SCRIPT_HASHES__";

export function collectInlineScriptHashes(outDir = OUT_DIR) {
  const hashes = new Set<string>();

  for (const entry of readdirSync(outDir)) {
    if (!entry.endsWith(".html")) {
      continue;
    }

    const html = readFileSync(join(outDir, entry), "utf8");
    const scriptPattern = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;

    for (const match of html.matchAll(scriptPattern)) {
      const content = match[1] ?? "";

      if (content.trim() === "") {
        continue;
      }

      hashes.add(
        `'sha256-${createHash("sha256").update(content).digest("base64")}'`,
      );
    }
  }

  return [...hashes].sort();
}

export function renderHeaders(template: string, hashes: string[]) {
  return template
    .split("\n")
    .filter((line) => !line.startsWith("#"))
    .join("\n")
    .replace(PLACEHOLDER, hashes.join(" "))
    .trimStart();
}

if (import.meta.main) {
  const template = readFileSync("public/_headers", "utf8");
  const hashes = collectInlineScriptHashes();
  writeFileSync(join(OUT_DIR, "_headers"), renderHeaders(template, hashes));
  console.log(
    `out/_headers written with ${hashes.length} inline script hashes`,
  );
}
