import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import { serializeGraphModel } from "../../features/graph-editor/core/graph/graph-json";
import { GRAPH_MAX_JSON_CHARS } from "../../features/graph-editor/core/graph/graph-limits";
import { I18nProvider } from "../../features/graph-editor/i18n/I18nProvider";
import { SUPPORTED_LOCALES } from "../../features/graph-editor/i18n/locale";
import { messagesByLocale } from "../../features/graph-editor/i18n/messages";
import { evaluateGraphInput } from "../../features/graph-editor/io/import-graph";
import type { ImportOptions } from "../../features/graph-editor/io/import-utils";
import {
  StarterPasteBody,
  StarterPasteFooter,
} from "../../features/graph-editor/ui/panels/StarterPanel";
import { focusAfterContentSwitch } from "../../features/graph-editor/ui/primitives/focus-after-content-switch";
import type { useGraphStarterState } from "../../features/graph-editor/workflows/starter/graph-starter-state";
import { IDLE_FILE_READ_STATE } from "../../features/graph-editor/workflows/starter/starter-file-read";
import {
  canApplyStarterInput,
  getStarterInputStatus,
  type StarterInputStatus,
} from "../../features/graph-editor/workflows/starter/starter-input-status";

type StarterState = ReturnType<typeof useGraphStarterState>;
function starter(inputText: string, options: ImportOptions = {}): StarterState {
  const { analysis, result } = evaluateGraphInput(inputText, options);
  return {
    inputText,
    analysis,
    preview: result,
    previewPending: false,
    visibleIssues: result.warnings,
    issues: [],
    importFormat: options.format ?? "auto",
    fileReadState: IDLE_FILE_READ_STATE,
    open: true,
    tab: "paste",
    close: () => {},
    cancelFileRead: () => {},
    readFile: async () => {},
    applyText: () => {},
    setImportFormat: () => {},
    setInput: () => {},
    setTab: () => {},
  };
}

const valid = starter("4 4\n1 2\n2 3\n2 4\n3 4", { indexBase: 1 });
const invalid = starter('{"version":2}');
const limit = starter("{" + " ".repeat(GRAPH_MAX_JSON_CHARS));
const textLimit = starter(`2 1\n0 1 ${"😀".repeat(257)}`, {
  weighted: true,
  weightKind: "string",
});
const ambiguous = starter("3\n1 2\n1 3", { indexBase: 1 });
const warning = starter("4 2\n1 2", {
  format: "contest-edge-list",
  indexBase: 1,
});
const noEdgeWarning = starter("4 2", {
  format: "contest-edge-list",
  indexBase: 1,
});
const emptyJson = starter(serializeGraphModel(createEmptyGraphModel()));
const checking = { ...valid, previewPending: true };
const reading = {
  ...valid,
  fileReadState: { status: "reading" as const },
};
const cases: [StarterState, StarterInputStatus][] = [
  [starter(" \n\t"), "empty"],
  [invalid, "review"],
  [limit, "review"],
  [textLimit, "review"],
  [ambiguous, "review"],
  [checking, "checking"],
  [{ ...valid, analysis: null, preview: null }, "checking"],
  [reading, "reading"],
  [{ ...reading, inputText: "" }, "reading"],
  [valid, "ready"],
  [emptyJson, "ready"],
  [warning, "warning"],
  [noEdgeWarning, "warning"],
];
assert.equal(invalid.analysis?.status, "invalid");
assert.equal(limit.analysis?.status, "limit");
assert.equal(textLimit.preview?.status, "failure");
assert.equal(textLimit.preview?.warnings[0]?.code, "text-too-long");
assert.equal(ambiguous.analysis?.status, "ambiguous");
assert.equal(warning.preview?.model.edges.length, 1);
assert.equal(noEdgeWarning.preview?.model.edges.length, 0);
assert.equal(noEdgeWarning.preview?.model.nodes.length, 4);

for (const [value, status] of cases) {
  assert.equal(getStarterInputStatus(value), status);
  for (const locale of SUPPORTED_LOCALES) {
    const messages = messagesByLocale[locale];
    const expectedLabel = {
      empty: messages.chrome.starterApply,
      reading: messages.starter.readingFile,
      checking: messages.starter.checkingInput,
      review: messages.starter.reviewInput,
      ready: messages.chrome.starterApply,
      warning: messages.starter.applyWithWarnings,
    }[status];
    const markup = renderToStaticMarkup(
      <I18nProvider initialLocale={locale}>
        <StarterPasteFooter starter={value} onUseSample={() => {}} />
      </I18nProvider>,
    );
    const button = [...markup.matchAll(/<button\b[^>]*>.*?<\/button>/g)].at(
      -1,
    )?.[0];
    assert(button, "rendered footer has an action button");
    assert(button.includes(expectedLabel), `${locale}: ${status} action label`);
    assert.equal(
      /\bdisabled=""/.test(button),
      !canApplyStarterInput(status),
      `${locale}: only validated current input may apply`,
    );
    assert(!button.includes("0 valid edges"));
    const body = renderToStaticMarkup(
      <I18nProvider initialLocale={locale}>
        <StarterPasteBody starter={value} textareaRef={{ current: null }} />
      </I18nProvider>,
    );
    const preview = body.match(
      /<div aria-label="[^"]*" class="ge-paste-preview[^>]*>(.*?)<\/div>/,
    )?.[1];
    assert(preview, "rendered paste has a preview pane");
    assert.equal(
      preview.includes("<svg"),
      canApplyStarterInput(status),
      "pending or rejected input cannot display a stale accepted preview",
    );
    if (value === textLimit) {
      assert(body.includes("257") && body.includes("256"));
      assert(
        body.includes(
          locale === "ja"
            ? "辺の重み"
            : locale === "en"
              ? "Edge weight"
              : "边权",
        ),
      );
    }
    if (status === "reading") {
      assert.equal(
        [...body.matchAll(/role="status"/g)].length,
        1,
        "file-reading state has one live status announcement",
      );
    }
  }
}

// Simulate the focus state seen when an async gallery replaces a removed
// switch button. A later explicit focus wins, even if the load is still pending.
const panel = { dataset: { panelState: "open" } } as unknown as HTMLElement;
const body = {} as HTMLElement;
const documentElement = {} as HTMLElement;
const close = {} as HTMLElement;
const footer = {} as HTMLElement;
const outside = {} as HTMLElement;
const documentState = {
  activeElement: body as Element | null,
  body,
  documentElement,
};
const focusOptions: FocusOptions[] = [];
const search = {
  isConnected: true,
  ownerDocument: documentState,
  closest: () => panel,
  focus(options: FocusOptions) {
    focusOptions.push(options);
    documentState.activeElement = this as unknown as HTMLElement;
  },
} as unknown as HTMLElement;
for (const lostFocus of [body, documentElement, panel, null]) {
  documentState.activeElement = lostFocus;
  focusAfterContentSwitch(search);
  assert.equal(
    documentState.activeElement,
    search,
    "cold / warm entry restores search focus",
  );
  assert.deepEqual(focusOptions.at(-1), { preventScroll: true });
}
for (const selected of [close, footer, outside, search]) {
  documentState.activeElement = selected;
  const calls = focusOptions.length;
  focusAfterContentSwitch(search);
  assert.equal(
    documentState.activeElement,
    selected,
    "delayed load preserves later focus",
  );
  assert.equal(focusOptions.length, calls);
}
panel.dataset.panelState = "closing";
documentState.activeElement = body;
focusAfterContentSwitch(search);
assert.equal(
  documentState.activeElement,
  body,
  "closing gallery does not claim focus",
);
panel.dataset.panelState = "open";
Object.assign(search, { isConnected: false });
focusAfterContentSwitch(search);
assert.equal(
  documentState.activeElement,
  body,
  "unmounted gallery does not claim focus",
);
focusAfterContentSwitch(null);

console.log(
  "Starter UI: current-input action labels in 3 locales and deferred focus handoff passed",
);
