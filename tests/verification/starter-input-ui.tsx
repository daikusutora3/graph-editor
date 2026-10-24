import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import { serializeGraphModel } from "../../features/graph-editor/core/graph/graph-json";
import { GRAPH_MAX_JSON_CHARS } from "../../features/graph-editor/core/graph/graph-limits";
import { I18nProvider } from "../../features/graph-editor/i18n/I18nProvider";
import { SUPPORTED_LOCALES } from "../../features/graph-editor/i18n/locale";
import { messagesByLocale } from "../../features/graph-editor/i18n/messages";
import { evaluateGraphInput } from "../../features/graph-editor/io/import-graph";
import {
  getImportExample,
  IMPORT_FORMAT_EXAMPLES,
} from "../../features/graph-editor/io/import-examples";
import type { ImportFormat } from "../../features/graph-editor/io/import-utils";
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
  isStarterApplyShortcut,
  type StarterInputStatus,
} from "../../features/graph-editor/workflows/starter/starter-input-status";

type StarterState = ReturnType<typeof useGraphStarterState>;
function starter(inputText: string, options: ImportOptions = {}): StarterState {
  const { analysis, result } = evaluateGraphInput(inputText, options);
  return {
    inputExample: getImportExample(
      options.format ?? "auto",
      options.indexBase ?? 0,
    ),
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

for (const indexBase of [0, 1] as const) {
  for (const format of Object.keys(IMPORT_FORMAT_EXAMPLES) as ImportFormat[]) {
    const example = getImportExample(format, indexBase);
    const { analysis, result } = evaluateGraphInput(example, {
      format,
      indexBase,
    });
    assert.equal(
      analysis.status,
      "detected",
      `${format}: example is unambiguous`,
    );
    assert.equal(
      result.status,
      "success",
      `${format}: example can be imported`,
    );
    assert.equal(
      result.warnings.length,
      0,
      `${format}: example needs no repairs`,
    );
    assert(result.model.nodes.length > 0 && result.model.edges.length > 0);
  }
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
  [starter("1 1 5\n1 1 a", { weighted: true }), "ready"],
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
    const input = body.match(/<textarea\b[^>]*>/)?.[0];
    const inputId = input?.match(/\bid="([^"]+)"/)?.[1];
    assert(inputId, "graph input has a stable label target");
    assert(
      body.includes(`<label for="${inputId}"`) &&
        body.includes(messages.starter.inputLabel),
      `${locale}: graph input has a visible label`,
    );
    const descriptions = input
      ?.match(/aria-describedby="([^"]+)"/)?.[1]
      ?.split(" ");
    assert(descriptions?.length, "graph input refers to its help text");
    for (const id of descriptions) {
      assert(body.includes(`id="${id}"`), "input descriptions exist");
    }
    assert.equal(
      input?.includes('aria-invalid="true"'),
      Boolean(value.inputText.trim()) &&
        (value.analysis?.status === "invalid" ||
          value.analysis?.status === "limit" ||
          value.preview?.status === "failure"),
      "blocking errors mark the field invalid; warnings remain applicable",
    );
    assert(
      !input?.includes("placeholder="),
      "input examples remain available outside the field",
    );
    assert(
      body.includes("data-import-example"),
      "format examples are always reachable",
    );
    const diagnostics = body.match(/<div\b[^>]*data-import-issues[^>]*>/)?.[0];
    if (diagnostics) {
      assert(
        !diagnostics.includes("role="),
        "typing diagnostics never interrupt text entry",
      );
      assert(!diagnostics.includes("aria-live="));
    }
    assert.equal(
      descriptions.length,
      value.visibleIssues.length > 0 ? 2 : 1,
      "input issues are associated with the field when present",
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

for (const locale of SUPPORTED_LOCALES) {
  const value: StarterState = {
    ...warning,
    visibleIssues: [1, 2, 3, 4, 5].map((line) => ({
      code: "missing-target",
      line,
    })),
  };
  const body = renderToStaticMarkup(
    <I18nProvider initialLocale={locale}>
      <StarterPasteBody starter={value} textareaRef={{ current: null }} />
    </I18nProvider>,
  );
  assert(
    body.includes("<details") &&
      body.includes(messagesByLocale[locale].starter.moreIssues(2)),
    `${locale}: remaining review items can be expanded with a native control`,
  );
  assert.equal(
    [...body.matchAll(/<li\b/g)].length,
    2,
    "review items beyond the first three remain available",
  );
}

const applyKey = {
  key: "Enter",
  metaKey: true,
  ctrlKey: false,
  altKey: false,
  isComposing: false,
  keyCode: 13,
  defaultPrevented: false,
};
assert(isStarterApplyShortcut(applyKey), "Command+Enter applies graph data");
assert(
  isStarterApplyShortcut({ ...applyKey, metaKey: false, ctrlKey: true }),
  "Control+Enter applies graph data",
);
for (const key of [
  { ...applyKey, isComposing: true },
  { ...applyKey, keyCode: 229 },
  { ...applyKey, altKey: true },
  { ...applyKey, defaultPrevented: true },
  { ...applyKey, metaKey: false },
]) {
  assert(
    !isStarterApplyShortcut(key),
    "editing or composing text must not apply data",
  );
}

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
