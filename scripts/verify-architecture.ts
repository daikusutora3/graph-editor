import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const SOURCE_DIRS = ["app", "features", "lib", "scripts"];
const BROWSER_GLOBAL_NAMES = new Set([
  "window",
  "document",
  "navigator",
  "localStorage",
  "sessionStorage",
  "ClipboardItem",
  "FileReader",
]);
const failures: string[] = [];

const files = SOURCE_DIRS.flatMap((dir) => readFiles(join(ROOT, dir))).filter(
  (file) => /\.(ts|tsx)$/.test(file),
);

for (const file of files) {
  const rel = relative(ROOT, file);
  const imports = readImports(file);
  const dependencies = imports.map((specifier) => ({
    specifier,
    target: resolveImport(rel, specifier),
  }));

  for (const specifier of imports) {
    if (
      specifier.startsWith("@/lib/graph") ||
      specifier.startsWith("@/state") ||
      specifier.startsWith("@/components/editor") ||
      specifier.includes("../lib/graph") ||
      specifier.includes("../components/editor")
    ) {
      failures.push(`${rel}: legacy graph-editor import ${specifier}`);
    }
  }

  if (rel.startsWith("scripts/")) {
    const bannedScriptTargets = [
      "features/graph-editor/adapters/browser",
      "features/graph-editor/adapters/cytoscape",
      "features/graph-editor/canvas",
      "features/graph-editor/shell",
      "features/graph-editor/ui",
      "features/graph-editor/workflows",
    ].filter(
      (target) =>
        !(
          rel === "scripts/verify-editor-state.ts" &&
          target === "features/graph-editor/shell"
        ),
    );

    for (const { specifier, target } of dependencies) {
      if (bannedScriptTargets.some((banned) => matchesTarget(target, banned))) {
        failures.push(
          `${rel}: scripts must not import browser/client module ${specifier}`,
        );
      }
    }
  }

  if (rel.includes("features/graph-editor/core/")) {
    assertNoImports(rel, imports, [
      "react",
      "jotai",
      "nanoid",
      "cytoscape",
      "lucide-react",
    ]);
    assertNoDependencyTargets(rel, dependencies, [
      "features/graph-editor/ui/",
      "features/graph-editor/shell/state/",
      "features/graph-editor/canvas/",
      "features/graph-editor/adapters/",
      "features/graph-editor/io/",
      "features/graph-editor/layouts/",
      "features/graph-editor/samples/",
      "features/graph-editor/workflows/",
    ]);
    assertNoBrowserGlobals(rel, file);
  }

  if (rel.includes("features/graph-editor/canvas/")) {
    assertNoDependencyTargets(rel, dependencies, ["features/graph-editor/ui/"]);
  }

  if (rel.includes("features/graph-editor/adapters/browser/")) {
    assertNoImports(rel, imports, ["react", "jotai", "lucide-react"]);
    assertNoDependencyTargets(rel, dependencies, [
      "features/graph-editor/ui/",
      "features/graph-editor/shell/state/",
      "features/graph-editor/canvas/",
    ]);
  }

  if (
    rel.includes("features/graph-editor/io/") ||
    rel.includes("features/graph-editor/layouts/") ||
    rel.includes("features/graph-editor/samples/")
  ) {
    assertNoImports(rel, imports, ["react", "jotai", "lucide-react"]);
    assertNoDependencyTargets(rel, dependencies, [
      "features/graph-editor/ui/",
      "features/graph-editor/shell/state/",
      "features/graph-editor/canvas/",
    ]);
    assertNoBrowserGlobals(rel, file);
  }

  if (rel.startsWith("scripts/") || rel.startsWith("lib/")) {
    assertNoBrowserGlobals(rel, file);
  }
}

if (failures.length > 0) {
  console.error(`Architecture verification failed (${failures.length})`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Architecture verification passed");

function assertNoImports(
  rel: string,
  imports: string[],
  bannedSpecifiers: string[],
) {
  for (const specifier of imports) {
    if (bannedSpecifiers.some((banned) => specifier.startsWith(banned))) {
      failures.push(`${rel}: forbidden import ${specifier}`);
    }
  }
}

function assertNoDependencyTargets(
  rel: string,
  dependencies: Array<{ specifier: string; target: string | null }>,
  bannedTargets: string[],
) {
  for (const { specifier, target } of dependencies) {
    if (bannedTargets.some((banned) => matchesTarget(target, banned))) {
      failures.push(`${rel}: forbidden dependency ${specifier}`);
    }
  }
}

function assertNoBrowserGlobals(rel: string, file: string) {
  if (rel === "scripts/verify-architecture.ts") {
    return;
  }

  for (const globalName of readBrowserGlobals(file)) {
    failures.push(`${rel}: forbidden browser global ${globalName}`);
  }
}

function matchesTarget(target: string | null, bannedTarget: string) {
  if (!target) return false;

  const normalizedTarget = normalizeTarget(target);
  const normalizedBanned = normalizeTarget(bannedTarget);

  return (
    normalizedTarget === normalizedBanned ||
    normalizedTarget.startsWith(`${normalizedBanned}/`)
  );
}

function normalizeTarget(target: string) {
  return normalize(target)
    .replace(/\.(ts|tsx)$/, "")
    .replace(/\/index$/, "")
    .replace(/\/$/, "");
}

function resolveImport(rel: string, specifier: string) {
  if (specifier.startsWith("@/")) {
    return normalizeTarget(specifier.slice(2));
  }

  if (!specifier.startsWith(".")) {
    return null;
  }

  return normalizeTarget(join(dirname(rel), specifier));
}

function readFiles(dir: string): string[] {
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

function readImports(file: string) {
  const sourceFile = readSourceFile(file);
  const imports = new Set<string>();

  visit(sourceFile);

  return [...imports];

  function visit(node: ts.Node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      imports.add(node.moduleSpecifier.text);
    }

    if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      ts.isStringLiteral(node.moduleReference.expression)
    ) {
      imports.add(node.moduleReference.expression.text);
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      imports.add(node.arguments[0].text);
    }

    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require" &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      imports.add(node.arguments[0].text);
    }

    ts.forEachChild(node, visit);
  }
}

function readBrowserGlobals(file: string) {
  const sourceFile = readSourceFile(file);
  const globals = new Set<string>();

  visit(sourceFile);

  return [...globals];

  function visit(node: ts.Node) {
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "URL" &&
      node.name.text === "createObjectURL"
    ) {
      globals.add("URL.createObjectURL");
    }

    if (ts.isIdentifier(node) && BROWSER_GLOBAL_NAMES.has(node.text)) {
      globals.add(node.text);
    }

    ts.forEachChild(node, visit);
  }
}
