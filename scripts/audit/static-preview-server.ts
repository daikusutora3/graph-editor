import { createServer } from "node:http";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { parseHeaderRules, resolveHeaders } from "../build-headers";

const contentTypes: Record<string, string> = {
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
  ".wasm": "application/wasm",
};

class PreviewRequestError extends Error {
  constructor(readonly status: 400 | 403) {
    super(status === 400 ? "Bad Request" : "Forbidden");
  }
}

function containsPath(directory: string, path: string) {
  const difference = relative(directory, path);
  return (
    !isAbsolute(difference) &&
    difference !== ".." &&
    !difference.startsWith(`..${sep}`)
  );
}

function requestPath(url: string) {
  // Inspect the original path before a URL parser can normalize dot segments.
  if (!url.startsWith("/") || url.startsWith("//")) {
    throw new PreviewRequestError(400);
  }
  const path = decodeURIComponent(url.split("?", 1)[0]);
  if (path.includes("\0")) throw new PreviewRequestError(400);
  if (path.replaceAll("\\", "/").split("/").includes("..")) {
    throw new PreviewRequestError(403);
  }
  return path;
}

function findFile(directory: string, candidate: string) {
  if (!containsPath(directory, candidate)) {
    throw new PreviewRequestError(403);
  }
  try {
    // Checking the real path also covers files reached through directory links.
    const canonical = realpathSync(candidate);
    if (!containsPath(directory, canonical)) {
      throw new PreviewRequestError(403);
    }
    return statSync(canonical).isFile() ? canonical : undefined;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") return undefined;
    throw error;
  }
}

type StaticRedirect = { source: string; destination: string; status: number };

/** Support the exact local redirects used by this export; reject silent drift. */
export function parseStaticRedirects(text: string): StaticRedirect[] {
  return text.split("\n").flatMap((rawLine, index) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) return [];
    const [source, destination, code = "302", ...extra] = line.split(/\s+/);
    const status = Number(code);
    if (
      !source?.startsWith("/") ||
      source.startsWith("//") ||
      /[*:?#]/.test(source) ||
      !destination?.startsWith("/") ||
      destination.startsWith("//") ||
      /[*:]/.test(destination) ||
      ![301, 302, 303, 307, 308].includes(status) ||
      extra.length > 0
    ) {
      throw new Error(
        `Unsupported static _redirects rule on line ${index + 1}`,
      );
    }
    return [{ source, destination, status }];
  });
}

/** The same handler can verify Request fixtures without opening a browser. */
export function createStaticPreviewHandler(outDirectory: string) {
  const directory = realpathSync(outDirectory);
  const rules = parseHeaderRules(
    readFileSync(join(directory, "_headers"), "utf8"),
  );
  let redirects: StaticRedirect[] = [];
  try {
    redirects = parseStaticRedirects(
      readFileSync(join(directory, "_redirects"), "utf8"),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return (request: Pick<Request, "method" | "url">) => {
    try {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: { allow: "GET, HEAD" },
        });
      }
      // Native HTTP supplies the original request target; Request fixtures
      // supply an absolute URL. Keep raw dot segments for the security check.
      const target = request.url.replace(/^https?:\/\/[^/]+/, "") || "/";
      const path = requestPath(target);
      const redirect = redirects.find((rule) => rule.source === path);
      if (redirect) {
        const queryIndex = target.indexOf("?");
        const query = queryIndex < 0 ? "" : target.slice(queryIndex);
        const destination = new URL(
          redirect.destination,
          "http://preview.invalid",
        );
        if (!redirect.destination.includes("?")) destination.search = query;
        // Cloudflare evaluates redirects before _headers and before assets.
        return new Response(null, {
          status: redirect.status,
          headers: {
            location:
              destination.pathname + destination.search + destination.hash,
          },
        });
      }
      const candidate = resolve(
        directory,
        `.${path === "/" ? "/index.html" : path}`,
      );
      let file =
        findFile(directory, candidate) ??
        findFile(directory, `${candidate}.html`);
      const status = file ? 200 : 404;
      // Unknown routes receive the exported 404 and their requested-path headers.
      file ??= findFile(directory, join(directory, "404.html"));
      if (!file) throw new Error("Missing static 404 page");
      const contents = readFileSync(file);
      return new Response(
        request.method === "HEAD" ? null : new Uint8Array(contents),
        {
          status,
          headers: {
            "content-type":
              contentTypes[extname(file)] ?? "application/octet-stream",
            "content-length": String(contents.length),
            ...Object.fromEntries(resolveHeaders(rules, path)),
          },
        },
      );
    } catch (error) {
      const status =
        error instanceof URIError
          ? 400
          : error instanceof PreviewRequestError
            ? error.status
            : 500;
      return new Response(
        request.method === "HEAD"
          ? null
          : status === 400
            ? "Bad Request"
            : status === 403
              ? "Forbidden"
              : "Internal Server Error",
        {
          status,
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "x-content-type-options": "nosniff",
          },
        },
      );
    }
  };
}

/** A local-only static export server. Rules are loaded once per start. */
export function startStaticPreviewServer(
  outDirectory: string,
  port: number,
  onListening?: () => void,
) {
  const handler = createStaticPreviewHandler(outDirectory);
  return createServer(async (request, response) => {
    const result = handler({
      method: request.method ?? "GET",
      url: request.url ?? "/",
    });
    response.writeHead(result.status, Object.fromEntries(result.headers));
    response.end(Buffer.from(await result.arrayBuffer()));
  }).listen(port, "127.0.0.1", onListening);
}
