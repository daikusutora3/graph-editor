import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Prepare same-form factories for routing-label-pairs-performance.ts. Reference
// replaces the snapshot module; --all-routing-changes also replaces scoring.
// Both factories share the measured kernel.
const revision = argument("--reference-revision");
const output = argument("--output-directory");
if (!revision || !output)
  throw new Error(
    "Pass --reference-revision <commit> --output-directory <path>",
  );
const root = fileURLToPath(new URL("../../", import.meta.url));
const directory = resolve(output);
const snapshotSource = "features/graph-editor/compute/wasm-routing.ts";
const sources = process.argv.includes("--all-routing-changes")
  ? [
      snapshotSource,
      "features/graph-editor/core/layout/edge-routing-scoring.ts",
    ]
  : [snapshotSource];
const referenceRevision = execFileSync("git", ["rev-parse", revision], {
  cwd: root,
  encoding: "utf8",
}).trim();
const referenceSources = sources.map((path) =>
  execFileSync("git", ["show", `${referenceRevision}:${path}`], {
    cwd: root,
    encoding: "utf8",
  }),
);
mkdirSync(directory, { recursive: true });
const entry = resolve(directory, "entry.ts");
writeFileSync(
  entry,
  `export { createEdgeRoutingTask } from ${JSON.stringify(resolve(root, "features/graph-editor/core/layout/edge-routing.ts"))};\n`,
);
await Promise.all(
  ["reference", "current"].map(async (variant) => {
    const result = await globalThis.Bun.build({
      entrypoints: [entry],
      target: "bun",
      outdir: resolve(directory, variant),
      naming: "routing.mjs",
      plugins: [
        {
          name: "shared-routing-kernel",
          setup(build) {
            build.onResolve(
              { filter: /(?:^|\/)rust-kernel(?:\.ts)?$/ },
              () => ({
                path: resolve(
                  root,
                  "features/graph-editor/compute/rust-kernel.ts",
                ),
                external: true,
              }),
            );
            if (variant === "reference")
              build.onLoad(
                {
                  filter:
                    /(?:compute\/wasm-routing|core\/layout\/edge-routing-scoring)\.ts$/,
                },
                ({ path }) => {
                  const index = sources.findIndex(
                    (source) => resolve(root, source) === path,
                  );
                  return index < 0
                    ? undefined
                    : { contents: referenceSources[index], loader: "ts" };
                },
              );
          },
        },
      ],
    });
    if (!result.success) throw new Error(JSON.stringify(result.logs));
  }),
);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const provenance = {
  referenceRevision,
  sources: sources.map((source, index) => ({
    source,
    referenceSha256: sha256(referenceSources[index]),
    currentSha256: sha256(readFileSync(resolve(root, source))),
  })),
  preparation:
    "Both factory bundles use current source; only the listed reference modules come from the recorded commit. Both externalize one canonical rust-kernel.ts instance.",
};
writeFileSync(
  resolve(directory, "preparation.json"),
  `${JSON.stringify(provenance, null, 2)}\n`,
);
console.log(JSON.stringify({ directory, ...provenance }));

function argument(flag) {
  const index = process.argv.indexOf(flag);
  return index < 0 ? undefined : process.argv[index + 1];
}
