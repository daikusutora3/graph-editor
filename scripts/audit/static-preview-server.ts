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

/** A local-only static export server. Header rules are loaded once per start. */
export function startStaticPreviewServer(
  outDirectory: string,
  port: number,
  onListening?: () => void,
) {
  const directory = realpathSync(outDirectory);
  const rules = parseHeaderRules(
    readFileSync(join(directory, "_headers"), "utf8"),
  );
  return createServer((request, response) => {
    try {
      if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405, { allow: "GET, HEAD" });
        response.end("Method Not Allowed");
        return;
      }
      const path = requestPath(request.url ?? "/");
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
      response.writeHead(status, {
        "content-type":
          contentTypes[extname(file)] ?? "application/octet-stream",
        "content-length": contents.length,
        ...Object.fromEntries(resolveHeaders(rules, path)),
      });
      response.end(request.method === "HEAD" ? undefined : contents);
    } catch (error) {
      const status =
        error instanceof URIError
          ? 400
          : error instanceof PreviewRequestError
            ? error.status
            : 500;
      response.writeHead(status, {
        "content-type": "text/plain; charset=utf-8",
        "x-content-type-options": "nosniff",
      });
      response.end(
        status === 400
          ? "Bad Request"
          : status === 403
            ? "Forbidden"
            : "Internal Server Error",
      );
    }
  }).listen(port, "127.0.0.1", onListening);
}
