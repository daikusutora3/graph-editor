// Serves the static export with the generated _headers (CSP, XFO) applied,
// so the production security headers can be exercised locally.
// Usage: bun run build && bun scripts/audit/serve-out.mjs   (PORT=3123)
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseHeaderRules, resolveHeaders } from "../build-headers.ts";

const OUT = fileURLToPath(new URL("../../out/", import.meta.url));
const PORT = Number(process.env.PORT ?? 3123);
const rules = parseHeaderRules(readFileSync(join(OUT, "_headers"), "utf8"));
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};

createServer((req, res) => {
  const requestPath = decodeURIComponent(
    new URL(req.url ?? "/", "http://localhost").pathname,
  );
  let file = join(OUT, requestPath === "/" ? "/index.html" : requestPath);
  if (
    (!existsSync(file) || statSync(file).isDirectory()) &&
    existsSync(`${file}.html`)
  ) {
    file = `${file}.html`;
  }
  let status = 200;
  if (!existsSync(file) || statSync(file).isDirectory()) {
    // Mirror Cloudflare's not_found_handling: unknown paths get 404.html
    // with the headers of the requested path.
    status = 404;
    file = join(OUT, "404.html");
  }
  res.writeHead(status, {
    "content-type": types[extname(file)] ?? "application/octet-stream",
    ...Object.fromEntries(resolveHeaders(rules, requestPath)),
  });
  res.end(readFileSync(file));
}).listen(PORT, () => console.log(`serving out/ on ${PORT}`));
