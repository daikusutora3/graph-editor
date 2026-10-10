import { once } from "node:events";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createStaticPreviewHandler,
  parseStaticRedirects,
  startStaticPreviewServer,
} from "../../scripts/audit/static-preview-server";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("Static preview server");
const fixture = mkdtempSync(join(tmpdir(), "graph-editor-static-preview-"));
const out = join(fixture, "out");
mkdirSync(out);
mkdirSync(join(out, "en"));
mkdirSync(join(out, "wasm"));
writeFileSync(join(out, "index.html"), "<h1>Root</h1>");
writeFileSync(join(out, "en.html"), "<h1>English</h1>");
writeFileSync(join(out, "en/guide.html"), "<h1>Guide</h1>");
mkdirSync(join(out, "zh-hans"));
for (const route of ["zh-hans", "guide", "zh-hans/guide"])
  writeFileSync(join(out, `${route}.html`), `<h1>${route}</h1>`);
writeFileSync(join(out, "404.html"), "<h1>Missing</h1>");
writeFileSync(join(out, "wasm/kernel.wasm"), "test-wasm-asset");
writeFileSync(
  join(out, "_headers"),
  `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
/en
  Content-Security-Policy: default-src 'self'
/en/guide
  Content-Security-Policy: default-src 'self'
/
  Content-Security-Policy: default-src 'self'
/zh-hans
  Content-Security-Policy: default-src 'self'
/guide
  Content-Security-Policy: default-src 'self'
/zh-hans/guide
  Content-Security-Policy: default-src 'self'
/wasm/*
  Content-Type: application/wasm
  Cache-Control: public, max-age=31536000, immutable
`,
);
const redirectText = readFileSync(
  new URL("../../public/_redirects", import.meta.url),
  "utf8",
);
writeFileSync(
  join(out, "_redirects"),
  `${redirectText}\n/with-query /en?mode=target#section 302\n/en/ /guide 308\n`,
);
writeFileSync(join(fixture, "private.txt"), "synthetic-private-value");
symlinkSync(join(fixture, "private.txt"), join(out, "outside.txt"));
symlinkSync(fixture, join(out, "outside-directory"));
symlinkSync(join(out, "en.html"), join(out, "inside.html"));

const server = startStaticPreviewServer(out, 0);
try {
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing server address");
  const port = address.port;
  expect(
    address.address === "127.0.0.1",
    "The preview must bind only IPv4 loopback.",
  );

  // Alias requests are pure Request fixtures, never requests to the user's
  // preview. Follow their Location through the exact handler used by HTTP.
  const handler = createStaticPreviewHandler(out);
  await Promise.all(
    parseStaticRedirects(redirectText).flatMap((rule) =>
      ["GET", "HEAD"].map(async (method) => {
        const alias = handler(
          new Request(`http://preview.invalid${rule.source}?mode=test`, {
            method,
          }),
        );
        expect(
          alias.status === 301 &&
            alias.headers.get("location") === `${rule.destination}?mode=test` &&
            (await alias.text()) === "",
          `Canonical aliases should redirect before assets: ${method} ${rule.source}`,
        );
        expect(
          !alias.headers.has("content-security-policy"),
          "_headers should apply to the destination asset, after redirects.",
        );
        const destination = handler(
          new Request(
            `http://preview.invalid${alias.headers.get("location")}`,
            {
              method,
            },
          ),
        );
        expect(
          destination.status === 200 &&
            destination.headers.get("content-security-policy") ===
              "default-src 'self'" &&
            destination.headers.get("x-frame-options") === "DENY",
          `Redirect destinations should serve their page CSP: ${rule.destination}`,
        );
      }),
    ),
  );
  const overriddenQuery = handler(
    new Request("http://preview.invalid/with-query?mode=source"),
  );
  expect(
    overriddenQuery.headers.get("location") === "/en?mode=target#section",
    "An explicit destination query should replace the incoming query.",
  );
  expect(
    handler(new Request("http://preview.invalid/en/?mode=test")).headers.get(
      "location",
    ) === "/en?mode=test",
    "The first matching redirect rule should win.",
  );
  for (const unsupported of [
    "/blog/* /posts/:splat 301",
    "/old https://example.invalid/new 301",
    "/old /new 200",
    "/old /new 301 extra",
  ]) {
    let rejected = false;
    try {
      parseStaticRedirects(unsupported);
    } catch {
      rejected = true;
    }
    expect(
      rejected,
      "Unsupported redirect syntax must fail instead of silently drifting.",
    );
  }

  function get(path: string, method = "GET") {
    return new Promise<{
      status: number;
      body: string;
      headers: import("node:http").IncomingHttpHeaders;
    }>((resolve, reject) => {
      const call = request(
        { hostname: "127.0.0.1", port, path, method },
        (response) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
          response.on("end", () =>
            resolve({
              status: response.statusCode ?? 0,
              body: Buffer.concat(chunks).toString("utf8"),
              headers: response.headers,
            }),
          );
          response.on("error", reject);
        },
      );
      call.on("error", reject);
      call.setTimeout(3000, () =>
        call.destroy(new Error("Preview request timed out")),
      );
      call.end();
    });
  }

  const root = await get("/");
  expect(
    root.status === 200 && root.body.includes("Root"),
    "The root should serve index.html.",
  );
  const english = await get("/en?mode=test");
  expect(
    english.status === 200 && english.body.includes("English"),
    "Clean routes and query strings should resolve exported HTML.",
  );
  expect(
    english.headers["content-security-policy"] === "default-src 'self'" &&
      english.headers["x-frame-options"] === "DENY",
    "Page-specific and common production headers should be applied.",
  );
  const guide = await get("/en/guide");
  expect(
    guide.status === 200 && guide.body.includes("Guide"),
    "Nested localized routes should serve their exported HTML.",
  );
  const wasm = await get("/wasm/kernel.wasm");
  expect(
    wasm.status === 200 &&
      wasm.headers["content-type"] === "application/wasm" &&
      wasm.headers["cache-control"]?.includes("immutable") === true,
    "Assets should retain their MIME type and cache headers.",
  );
  const missing = await get("/missing-route");
  expect(
    missing.status === 404 &&
      missing.body.includes("Missing") &&
      missing.headers["x-frame-options"] === "DENY",
    "Unknown paths should use the exported 404 and requested-path headers.",
  );

  await Promise.all(
    [
      "/../private.txt",
      "/%2e%2e%2fprivate.txt",
      "/%2e%2e/private.txt",
      "/%2e%2e%5cprivate.txt",
      "/en/%2e%2e/%2e%2e/private.txt",
    ].map(async (path) => {
      const result = await get(path);
      expect(
        result.status === 403 &&
          !result.body.includes("synthetic-private-value"),
        `Traversal must be rejected before reading files: ${path}`,
      );
    }),
  );
  await Promise.all(
    ["/%", "/%FF", "/%00"].map(async (path) => {
      const result = await get(path);
      expect(
        result.status === 400,
        `Invalid URI input must return 400 without terminating the server: ${path}`,
      );
    }),
  );
  await Promise.all(
    ["/outside.txt", "/outside-directory/private.txt"].map(async (path) => {
      const result = await get(path);
      expect(
        result.status === 403 &&
          !result.body.includes("synthetic-private-value"),
        `Symlinks outside the export must be rejected: ${path}`,
      );
    }),
  );
  const internal = await get("/inside.html");
  expect(
    internal.status === 200 && internal.body.includes("English"),
    "A symlink resolving inside the export may be served.",
  );
  const head = await get("/en", "HEAD");
  expect(
    head.status === 200 &&
      head.body === "" &&
      Number(head.headers["content-length"]) > 0,
    "HEAD should report normal asset headers without a response body.",
  );
  const post = await get("/en", "POST");
  expect(
    post.status === 405 && post.headers.allow === "GET, HEAD",
    "The static preview should reject mutation methods.",
  );
  const healthy = await get("/en");
  expect(
    healthy.status === 200,
    "Rejected requests must leave the server usable.",
  );
} finally {
  if (server.listening) {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
  rmSync(fixture, { recursive: true, force: true });
}

finish();
