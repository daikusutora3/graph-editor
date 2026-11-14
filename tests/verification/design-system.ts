import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { createVerification } from "./harness";

/**
 * Design-system contracts for feature and page code.
 *
 * `components/ui` owns the recipes (controls, surfaces, menus, text). Everything
 * else must compose them instead of re-creating borders, surfaces, radii, type
 * sizes, blur, or colors by hand. See docs/design-system.md for the rationale and
 * the recipe to use instead of each rule below.
 */

const { expect, finish } = createVerification("Design system");
const root = fileURLToPath(new URL("../..", import.meta.url));

const scanned = [
  "app",
  "components/content",
  "features/graph-editor/ui",
  "features/graph-editor/canvas",
  "features/graph-editor/shell",
];

type Rule = {
  id: string;
  pattern: RegExp | ((line: string) => boolean);
  fix: string;
  /** Limit the rule to files whose path matches. */
  scope?: RegExp;
};

const rules: Rule[] = [
  {
    id: "blur",
    pattern: /\bbackdrop-blur-/,
    fix: "use surface.floating (ge-panel), which owns the blur",
  },
  {
    id: "arbitrary-radius",
    pattern: /\brounded(?:-[trbl]{1,2})?-\[/,
    fix: "use rounded-bar / rounded-xl / rounded-lg / rounded-md",
  },
  {
    id: "arbitrary-font-size",
    pattern: /\btext-\[\d+(?:\.\d+)?(?:px|rem)\]/,
    fix: "use text-meta / text-xs / text-control / text-sm and up",
  },
  {
    id: "palette-color",
    pattern:
      /\b(?:bg|text|border|fill|stroke)-(?:white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})\b|\[#[0-9a-fA-F]{3,8}\]/,
    fix: "use a semantic token from app/globals.css (var(--…))",
  },
  {
    id: "control-border",
    pattern: /border-\[var\(--control-border\)\]/,
    fix: "use Select / TextInput / fieldSurface or Button variant=secondary",
  },
  {
    id: "hand-rolled-surface",
    // A full outlined surface: rounded + all-side --line border + a surface fill.
    pattern: (line) =>
      /\brounded-(?:md|lg|xl|2xl)\b/.test(line) &&
      /\bborder border-\[var\(--line\)\]/.test(line) &&
      /\bbg-\[var\(--(?:bg|panel-solid)\)\]/.test(line),
    fix: "use surface.card or surface.inset",
  },
  {
    id: "raw-button",
    // Editor UI composes the shared controls; reading pages use components/content.
    scope: /^features\//,
    pattern: /<(?:button|a)(?:\s|>|$)/,
    fix: "use Button, IconButton, LinkButton, ActionRow, Segment, or OptionToggle",
  },
  {
    id: "reading-recipe",
    // Guide and article pages are plain documents built from shared recipes.
    scope: /^(?:app\/(?:guide|articles)|components\/content)\//,
    pattern: (line) =>
      !line.includes("reading.") &&
      /\b(?:divide-y|list-disc|list-decimal|leading-\[|text-\[clamp|text-\[var\(--accent)/.test(
        line,
      ),
    fix: "use the reading recipes (reading.body / list / steps / rows / link) from components/content/reading.ts",
  },
  {
    id: "elevation-shadow",
    pattern: /\b(?:drop-)?shadow-(?:sm|md|lg|xl|2xl)\b/,
    fix: "surfaces are flat; separate them with --line borders",
  },
];

// Exceptions must say why. Keep this list short.
const allowed: Record<string, string[]> = {
  // The reading recipes themselves.
  "components/content/reading.ts": ["reading-recipe"],
  // The PNG export previews are rendered on white by design (they show the exported file).
  "app/guide/GuideExamples.tsx": ["palette-color"],
  // The start-card illustration draws a tiny "text file" as artwork, not a UI surface.
  "features/graph-editor/ui/chrome/EmptyStateIllustration.tsx": [
    "hand-rolled-surface",
  ],
  // Invisible hit targets that sit on top of canvas nodes and edges.
  "features/graph-editor/canvas/GraphCanvasHitboxOverlays.tsx": ["raw-button"],
  // Color swatches are drawn as the color itself, not as a button face.
  "features/graph-editor/canvas/SelectionActionBar.tsx": ["raw-button"],
  // The brand pill is a floating bar of its own (surface.floating + rounded-bar).
  "features/graph-editor/ui/chrome/EditorToolbar.tsx": ["raw-button"],
  // Start cards: the whole card (surface.card) is the button.
  "features/graph-editor/ui/chrome/EmptyState.tsx": ["raw-button"],
  // Skip link that only appears on keyboard focus.
  "features/graph-editor/shell/GraphEditor.tsx": ["raw-button"],
  // Mobile bottom sheet top corners follow the platform sheet radius.
  "features/graph-editor/ui/chrome/EditorPanelShell.tsx": ["arbitrary-radius"],
};

const cssSources = [
  join(root, "app/globals.css"),
  ...["app", "components", "features"].flatMap((directory) =>
    files(join(root, directory), /\.css$/),
  ),
];
const definedTokens = new Set(
  cssSources.flatMap((path) =>
    [...readFileSync(path, "utf8").matchAll(/(--[a-z0-9-]+)\s*:/g)].map(
      (match) => match[1]!,
    ),
  ),
);

function files(directory: string, include = /\.(tsx|ts)$/): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return files(path, include);
    return include.test(entry) ? [path] : [];
  });
}

let checked = 0;
for (const directory of scanned) {
  for (const path of files(join(root, directory))) {
    const file = relative(root, path);
    const source = readFileSync(path, "utf8");
    const lines = source.split("\n");
    checked += 1;
    lines.forEach((line, index) => {
      if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*"))
        return;
      for (const rule of rules) {
        if (allowed[file]?.includes(rule.id)) continue;
        if (rule.scope && !rule.scope.test(file)) continue;
        const hit =
          typeof rule.pattern === "function"
            ? rule.pattern(line)
            : rule.pattern.test(line);
        expect(!hit, `${file}:${index + 1} [${rule.id}] ${rule.fix}`);
      }
      for (const match of line.matchAll(/var\((--[a-z0-9-]+)/g)) {
        const token = match[1]!;
        // Runtime-only variables, and names completed by a template (`--canvas-node-${color}`).
        if (/^--(?:ge|tw)-/.test(token) || token.endsWith("-")) continue;
        expect(
          definedTokens.has(token),
          `${file}:${index + 1} [unknown-token] ${token} is not defined in app/globals.css`,
        );
      }
    });
  }
}

expect(
  checked > 50,
  `scanned only ${checked} files; check the scanned directories`,
);

finish(`Design system contracts passed (${checked} files)`);
