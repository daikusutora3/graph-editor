import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { APP_NAME, SITE_URL } from "../../lib/site-metadata";

const root = process.cwd();
const failures: string[] = [];

function expect(condition: boolean, message: string) {
  if (!condition) {
    failures.push(message);
  }
}

function readText(path: string) {
  return readFileSync(join(root, path), "utf8");
}

function expectFile(path: string) {
  expect(existsSync(join(root, path)), `${path} should exist`);
}

for (const path of [
  "out/index.html",
  "out/404.html",
  "out/manifest.webmanifest",
  "out/robots.txt",
  "out/sitemap.xml",
  "out/_headers",
  "out/brand/graph-editor-logo.webp",
  "out/brand/graph-editor-logo-dark.webp",
  "out/brand/graph-editor-logo-180.png",
]) {
  expectFile(path);
}

const wrangler = readText("wrangler.jsonc");
expect(
  /"directory"\s*:\s*"\.\/out"/.test(wrangler),
  "wrangler.jsonc should serve ./out as static assets",
);
expect(
  /"not_found_handling"\s*:\s*"404-page"/.test(wrangler),
  "wrangler.jsonc should use the exported 404 page",
);

const indexHtml = readText("out/index.html");
expect(indexHtml.includes(APP_NAME), "out/index.html should include app name");

const manifest = JSON.parse(readText("out/manifest.webmanifest")) as {
  name?: string;
  start_url?: string;
  icons?: unknown[];
};
expect(manifest.name === APP_NAME, "manifest should use the app name");
expect(manifest.start_url === "/", "manifest should start at /");
expect(
  Array.isArray(manifest.icons) && manifest.icons.length >= 2,
  "manifest should include app icons",
);

const robots = readText("out/robots.txt");
expect(
  robots.includes(`${SITE_URL}/sitemap.xml`),
  "robots.txt should point to the public sitemap URL",
);
expect(
  robots.includes("User-Agent: *"),
  "robots.txt should include the default crawler rule",
);

const sitemap = readText("out/sitemap.xml");
expect(sitemap.includes(SITE_URL), "sitemap.xml should include SITE_URL");

const headers = readText("out/_headers");
expect(
  headers.includes("X-Content-Type-Options: nosniff"),
  "_headers should include nosniff",
);
expect(
  headers.includes(
    "Permissions-Policy: camera=(), microphone=(), geolocation=()",
  ),
  "_headers should keep browser capability restrictions",
);

if (failures.length > 0) {
  console.error(`Release verification failed (${failures.length})`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Release verification passed");
