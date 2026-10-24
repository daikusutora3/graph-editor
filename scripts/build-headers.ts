import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const OUT_DIR = "out";
const PLACEHOLDER = "__INLINE_SCRIPT_HASHES__";

export const HEADERS_LINE_LIMIT = 2000;
export const HEADERS_RULE_LIMIT = 100;

export type PageScriptHashes = { route: string; hashes: string[] };

function walkHtmlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      return walkHtmlFiles(path);
    }

    return entry.name.endsWith(".html") ? [path] : [];
  });
}

export function routeForHtmlFile(relativePath: string) {
  const posixPath = relativePath
    .split(sep)
    .join("/")
    .replace(/\.html$/, "");

  if (posixPath === "index") {
    return "/";
  }

  return `/${posixPath.replace(/\/index$/, "")}`;
}

export function collectPageScriptHashes(outDir = OUT_DIR): PageScriptHashes[] {
  const pages: PageScriptHashes[] = [];
  const scriptPattern = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g;

  for (const file of walkHtmlFiles(outDir)) {
    const html = readFileSync(file, "utf8");
    const hashes = new Set<string>();

    for (const match of html.matchAll(scriptPattern)) {
      const attributes = match[1] ?? "";
      const content = match[2] ?? "";

      if (
        content.trim() === "" ||
        /type=["']application\/ld\+json["']/.test(attributes)
      ) {
        continue;
      }

      hashes.add(
        `'sha256-${createHash("sha256").update(content).digest("base64")}'`,
      );
    }

    if (hashes.size > 0) {
      pages.push({
        route: routeForHtmlFile(relative(outDir, file)),
        hashes: [...hashes].sort(),
      });
    }
  }

  return pages.sort((a, b) => a.route.localeCompare(b.route));
}

export function collectInlineScriptHashes(outDir = OUT_DIR) {
  return [
    ...new Set(collectPageScriptHashes(outDir).flatMap((page) => page.hashes)),
  ].sort();
}

export function renderHeaders(template: string, pages: PageScriptHashes[]) {
  const lines = template.split("\n").filter((line) => !line.startsWith("#"));
  const cspTemplate = lines.find((line) => line.includes(PLACEHOLDER));

  if (cspTemplate === undefined) {
    throw new Error(`public/_headers must contain ${PLACEHOLDER}`);
  }

  const base = lines
    .filter((line) => line !== cspTemplate)
    .join("\n")
    .trim();
  const pageRules = pages.map((page) =>
    [page.route, cspTemplate.replace(PLACEHOLDER, page.hashes.join(" "))].join(
      "\n",
    ),
  );
  const output = `${[base, ...pageRules].join("\n\n")}\n`;

  for (const line of output.split("\n")) {
    if (line.length > HEADERS_LINE_LIMIT) {
      throw new Error(
        `_headers line exceeds ${HEADERS_LINE_LIMIT} characters: ${line.slice(0, 80)}…`,
      );
    }
  }

  const ruleCount = output
    .split("\n")
    .filter((line) => line.startsWith("/")).length;

  if (ruleCount > HEADERS_RULE_LIMIT) {
    throw new Error(
      `_headers has ${ruleCount} rules, limit ${HEADERS_RULE_LIMIT}`,
    );
  }

  return output;
}

export type HeaderRule = {
  pattern: RegExp;
  set: Array<[name: string, value: string]>;
  unset: string[];
};

export function parseHeaderRules(text: string): HeaderRule[] {
  const rules: HeaderRule[] = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimEnd();

    if (line === "" || line.startsWith("#")) {
      continue;
    }

    if (!rawLine.startsWith(" ")) {
      const source = line
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*")
        .replace(/:[A-Za-z_]+/g, "[^/]+");
      rules.push({ pattern: new RegExp(`^${source}$`), set: [], unset: [] });
      continue;
    }

    const rule = rules.at(-1);
    const entry = line.trim();

    if (rule === undefined) {
      throw new Error(`_headers line outside of a rule: ${entry}`);
    }

    if (entry.startsWith("! ")) {
      rule.unset.push(entry.slice(2).trim().toLowerCase());
      continue;
    }

    const separator = entry.indexOf(":");
    rule.set.push([
      entry.slice(0, separator).trim().toLowerCase(),
      entry.slice(separator + 1).trim(),
    ]);
  }

  return rules;
}

export function resolveHeaders(rules: HeaderRule[], path: string) {
  const headers = new Map<string, string>();

  for (const rule of rules) {
    if (!rule.pattern.test(path)) {
      continue;
    }

    for (const name of rule.unset) {
      headers.delete(name);
    }

    for (const [name, value] of rule.set) {
      const existing = headers.get(name);
      headers.set(
        name,
        existing === undefined ? value : `${existing}, ${value}`,
      );
    }
  }

  return headers;
}

if (import.meta.main) {
  const template = readFileSync("public/_headers", "utf8");
  const pages = collectPageScriptHashes();
  writeFileSync(join(OUT_DIR, "_headers"), renderHeaders(template, pages));
  console.log(
    `out/_headers written with per-page CSP rules for ${pages.length} pages (${collectInlineScriptHashes().length} inline script hashes)`,
  );
}
