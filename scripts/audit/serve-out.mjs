// Serves the static export with the generated _headers (CSP, XFO) applied,
// so the production security headers can be exercised locally.
// Usage: bun run build && bun scripts/audit/serve-out.mjs   (PORT=3123)
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../../out/", import.meta.url));
const PORT = Number(process.env.PORT ?? 3123);
const headersText = readFileSync(join(OUT, "_headers"), "utf8");
const cspLine = headersText
  .split("\n")
  .find((line) => line.trim().startsWith("Content-Security-Policy:"));
const csp = cspLine
  ? cspLine.trim().slice("Content-Security-Policy:".length).trim()
  : "";
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
  let path = decodeURIComponent(
    new URL(req.url ?? "/", "http://localhost").pathname,
  );
  if (path === "/") path = "/index.html";
  let file = join(OUT, path);
  if (
    (!existsSync(file) || statSync(file).isDirectory()) &&
    existsSync(`${file}.html`)
  ) {
    file = `${file}.html`;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, {
    "content-type": types[extname(file)] ?? "application/octet-stream",
    "content-security-policy": csp,
    "x-frame-options": "DENY",
  });
  res.end(readFileSync(file));
}).listen(PORT, () => console.log(`serving out/ on ${PORT}`));
