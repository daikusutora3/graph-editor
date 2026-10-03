import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

// Build first. Count unique JS references in the static entry page, including
// preloads; modern browsers do not download the nomodule polyfill.
const outputDirectory = process.argv[2] ?? "out";
const html = readFileSync(join(outputDirectory, "index.html"), "utf8");
const references = new Map<string, string>();
for (const [tag] of html.matchAll(/<(?:script|link)\b[^>]*>/g)) {
  const reference = tag.match(/(?:src|href)="(\/_next\/static\/[^"]+\.js)"/);
  if (reference) references.set(reference[1]!, tag);
}
const chunks = [...references].map(([path, tag]) => {
  const contents = readFileSync(join(outputDirectory, path));
  return {
    path,
    legacyOnly: /\bnomodule\b/i.test(tag),
    bytes: contents.length,
    gzipBytes: gzipSync(contents, { level: 9 }).length,
  };
});
const modernChunks = chunks.filter((chunk) => !chunk.legacyOnly);
console.log(
  JSON.stringify(
    {
      initialModernBytes: modernChunks.reduce(
        (sum, chunk) => sum + chunk.bytes,
        0,
      ),
      initialModernGzipBytes: modernChunks.reduce(
        (sum, chunk) => sum + chunk.gzipBytes,
        0,
      ),
      chunks,
    },
    null,
    2,
  ),
);
