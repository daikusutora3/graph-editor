import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * User-facing text must live in i18n/messages.ts. This scans application
 * code for CJK characters so a hard-coded Japanese string cannot ship to the
 * English or Chinese UI unnoticed.
 */
const roots = ["features", "app", "lib"];
const allowed = [
  "features/graph-editor/i18n/",
  "features/graph-editor/samples/",
  "lib/site-metadata.ts",
  "lib/guide-content.ts",
];
const cjk = /[\u3000-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uff00-\uffef]/;
const findings: string[] = [];

function walk(dir: string) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);

    if (statSync(path).isDirectory()) {
      walk(path);
      continue;
    }

    if (!/\.(ts|tsx)$/.test(path)) {
      continue;
    }

    const rel = relative(process.cwd(), path);

    if (allowed.some((prefix) => rel.startsWith(prefix))) {
      continue;
    }

    readFileSync(path, "utf8")
      .split("\n")
      .forEach((line, index) => {
        if (
          cjk.test(line) &&
          !line.trimStart().startsWith("//") &&
          !line.trimStart().startsWith("*")
        ) {
          findings.push(`${rel}:${index + 1}: ${line.trim().slice(0, 80)}`);
        }
      });
  }
}

for (const root of roots) {
  walk(root);
}

if (findings.length > 0) {
  console.error("Hard-coded CJK text outside i18n:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log("i18n literal check passed");
