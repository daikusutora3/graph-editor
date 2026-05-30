import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  APP_DESCRIPTION,
  APP_NAME,
  APP_TITLE,
  SITE_URL,
  SOCIAL_IMAGE,
  structuredData,
} from "../../lib/site-metadata";
import { createVerification } from "./harness";

const root = process.cwd();
const { expect, finish } = createVerification("Release");

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
expect(
  indexHtml.includes(APP_TITLE),
  "out/index.html should include app title",
);
expect(
  indexHtml.includes(APP_DESCRIPTION),
  "out/index.html should include the public app description",
);
expect(
  indexHtml.includes(`property="og:locale" content="ja_JP"`),
  "out/index.html should set the root Open Graph locale",
);
expect(
  !indexHtml.includes("og:locale:alternate"),
  "out/index.html should not advertise locale alternates without locale URLs",
);
expect(
  indexHtml.includes(`property="og:title" content="${APP_TITLE}"`),
  "out/index.html should keep Open Graph title aligned with public metadata",
);
expect(
  indexHtml.includes(`property="og:description" content="${APP_DESCRIPTION}"`),
  "out/index.html should keep Open Graph description aligned with public metadata",
);
expect(
  indexHtml.includes(`name="twitter:title" content="${APP_TITLE}"`),
  "out/index.html should keep Twitter title aligned with public metadata",
);
expect(
  indexHtml.includes(`name="twitter:description" content="${APP_DESCRIPTION}"`),
  "out/index.html should keep Twitter description aligned with public metadata",
);
expect(
  indexHtml.includes(SOCIAL_IMAGE),
  "out/index.html should include the social image",
);
expect(
  indexHtml.includes(structuredData.description),
  "out/index.html should align JSON-LD description with public metadata",
);

const manifest = JSON.parse(readText("out/manifest.webmanifest")) as {
  description?: string;
  name?: string;
  start_url?: string;
  icons?: unknown[];
};
expect(manifest.name === APP_NAME, "manifest should use the app name");
expect(
  manifest.description === APP_DESCRIPTION,
  "manifest should use the public app description",
);
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
expect(
  !sitemap.includes(`${SITE_URL}/en`) && !sitemap.includes(`${SITE_URL}/zh-cn`),
  "sitemap.xml should not list locale URLs while the app uses a single public URL",
);

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

finish();
