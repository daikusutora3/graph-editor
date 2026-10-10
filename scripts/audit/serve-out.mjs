// Serves the static export with the generated _headers (CSP, XFO) applied.
// Usage: bun run build && bun scripts/audit/serve-out.mjs   (PORT=3123)
import { startStaticPreviewServer } from "./static-preview-server.ts";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../../out/", import.meta.url));
const PORT = Number(process.env.PORT ?? 3123);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

startStaticPreviewServer(OUT, PORT, () =>
  console.log(`serving out/ on http://127.0.0.1:${PORT}`),
);
