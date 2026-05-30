import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const SOURCE_DIRS = ["app", "features", "lib"];
const failures: string[] = [];

assertStaticNextExport();
assertWorkersStaticAssetsConfig();
assertMissingCloudflareWorkerEntrypoints();

for (const file of SOURCE_DIRS.flatMap((dir) => readFiles(join(ROOT, dir)))) {
  if (!/\.(ts|tsx)$/.test(file)) continue;

  const rel = relative(ROOT, file);
  const sourceFile = readSourceFile(file);

  if (/^app\/.*\/route\.tsx?$/.test(rel)) {
    failures.push(`${rel}: route handlers would reintroduce request-time code`);
  }

  visitSource(rel, sourceFile);
}

for (const fileName of ["middleware.ts", "middleware.tsx", "middleware.js"]) {
  if (existsSync(join(ROOT, fileName))) {
    failures.push(
      `${fileName}: middleware would reintroduce request-time code`,
    );
  }
}

if (failures.length > 0) {
  console.error(
    `Deployment cost guard verification failed (${failures.length})`,
  );
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Deployment cost guard verification passed");

function assertStaticNextExport() {
  const config = readFileSync(join(ROOT, "next.config.ts"), "utf8");

  if (!/\boutput\s*:\s*["']export["']/.test(config)) {
    failures.push(
      'next.config.ts: expected output: "export" for static deploys',
    );
  }
}

function assertMissingCloudflareWorkerEntrypoints() {
  const blockedPaths = [
    "functions",
    "_worker.js",
    "public/_worker.js",
    "public/_routes.json",
    "wrangler.json",
    "wrangler.toml",
  ];

  for (const blockedPath of blockedPaths) {
    if (existsSync(join(ROOT, blockedPath))) {
      failures.push(
        `${blockedPath}: Cloudflare Worker/Pages Functions entrypoints are not part of the static deployment contract`,
      );
    }
  }
}

function assertWorkersStaticAssetsConfig() {
  const configPath = join(ROOT, "wrangler.jsonc");

  if (!existsSync(configPath)) {
    failures.push(
      "wrangler.jsonc: expected Workers Static Assets config for Cloudflare deploys",
    );
    return;
  }

  const parsed = ts.parseConfigFileTextToJson(
    configPath,
    readFileSync(configPath, "utf8"),
  );

  if (parsed.error) {
    const message = ts.flattenDiagnosticMessageText(
      parsed.error.messageText,
      "\n",
    );
    failures.push(`wrangler.jsonc: invalid JSONC config: ${message}`);
    return;
  }

  const config = parsed.config as {
    name?: unknown;
    main?: unknown;
    assets?: {
      directory?: unknown;
      run_worker_first?: unknown;
      not_found_handling?: unknown;
    };
  };

  if (config.name !== "graph-editor") {
    failures.push('wrangler.jsonc: expected name to be "graph-editor"');
  }

  if ("main" in config) {
    failures.push(
      "wrangler.jsonc: main must be omitted for static-assets-only deploys",
    );
  }

  if (config.assets?.directory !== "./out") {
    failures.push('wrangler.jsonc: expected assets.directory to be "./out"');
  }

  if ("run_worker_first" in (config.assets ?? {})) {
    failures.push(
      "wrangler.jsonc: run_worker_first would invoke Worker code before static assets",
    );
  }

  if (config.assets?.not_found_handling !== "404-page") {
    failures.push(
      'wrangler.jsonc: expected assets.not_found_handling to be "404-page"',
    );
  }
}

function visitSource(rel: string, sourceFile: ts.SourceFile) {
  const visit = (node: ts.Node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const specifier = node.moduleSpecifier.text;

      if (specifier === "next/server") {
        failures.push(`${rel}: next/server depends on request-time runtime`);
      }

      if (specifier === "next/image") {
        failures.push(
          `${rel}: next/image can require image optimization runtime`,
        );
      }
    }

    if (ts.isExpressionStatement(node) && ts.isStringLiteral(node.expression)) {
      if (node.expression.text === "use server") {
        failures.push(
          `${rel}: server actions are outside the static deployment contract`,
        );
      }
    }

    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const callName = node.expression.text;

      if (callName === "fetch") {
        failures.push(
          `${rel}: fetch() can turn crawler traffic into upstream load`,
        );
      }

      if (
        callName === "headers" ||
        callName === "cookies" ||
        callName === "draftMode"
      ) {
        failures.push(`${rel}: ${callName}() depends on request-time runtime`);
      }
    }

    if (
      ts.isVariableStatement(node) &&
      node.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      )
    ) {
      for (const declaration of node.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;

        const name = declaration.name.text;
        const initializer = declaration.initializer;

        if (
          name === "dynamic" &&
          initializer &&
          ts.isStringLiteral(initializer) &&
          initializer.text === "force-dynamic"
        ) {
          failures.push(`${rel}: force-dynamic disables static rendering`);
        }

        if (name === "revalidate") {
          failures.push(
            `${rel}: revalidate requires a non-static deployment contract`,
          );
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
}

function readFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);

    return stat.isDirectory() ? readFiles(path) : [path];
  });
}

function readSourceFile(file: string) {
  const source = readFileSync(file, "utf8");
  const scriptKind = file.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : ts.ScriptKind.TS;

  return ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
}
