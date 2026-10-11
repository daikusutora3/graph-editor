import assert from "node:assert/strict";
import { Provider, createStore } from "jotai";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "../../features/graph-editor/i18n/I18nProvider";
import { SUPPORTED_LOCALES } from "../../features/graph-editor/i18n/locale";
import { integrityCopy } from "../../features/graph-editor/i18n/integrity-copy";
import { GraphCanvasProvider } from "../../features/graph-editor/canvas/GraphCanvasProvider";
import {
  StorageNotice,
  StorageNoticeContent,
} from "../../features/graph-editor/ui/chrome/StorageNotice";
import type { StorageSnapshot } from "../../features/graph-editor/adapters/browser/stored-graph";
import { commandErrorAtom } from "../../features/graph-editor/shell/state/history-atoms";
import { GRAPH_MAX_ABS_COORDINATE } from "../../features/graph-editor/core/graph/graph-coordinates";
import {
  GraphContractError,
  serializeGraphModel,
} from "../../features/graph-editor/core/graph/graph-json";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";

const keys = Object.keys(integrityCopy.en);
const validStoredGraph = serializeGraphModel(createEmptyGraphModel());
const recoveryCases: {
  name: string;
  state: StorageSnapshot;
  actions: readonly ("backup" | "retry" | "raw" | "load" | "fresh")[];
}[] = [
  {
    name: "saved",
    state: { status: "saved", raw: validStoredGraph },
    actions: [],
  },
  {
    name: "pending",
    state: { status: "pending", raw: validStoredGraph },
    actions: [],
  },
  {
    name: "failed",
    state: { status: "failed", raw: validStoredGraph },
    actions: ["backup", "retry"],
  },
  {
    name: "conflict-valid",
    state: { status: "conflict", raw: validStoredGraph },
    actions: ["backup", "load"],
  },
  {
    name: "conflict-invalid",
    state: { status: "conflict", raw: "broken" },
    actions: ["backup", "raw", "fresh"],
  },
  {
    name: "conflict-deleted",
    state: { status: "conflict", raw: null },
    actions: ["backup", "fresh"],
  },
  {
    name: "unavailable",
    state: { status: "unavailable", raw: validStoredGraph },
    actions: ["backup"],
  },
  {
    name: "invalid",
    state: { status: "invalid", raw: "broken" },
    actions: ["backup", "raw", "fresh"],
  },
];
const actionKeys = ["backup", "retry", "raw", "load", "fresh"] as const;
const escapedText = (text: string) => renderToStaticMarkup(<>{text}</>);

for (const locale of SUPPORTED_LOCALES) {
  const copy = integrityCopy[locale];
  assert.deepEqual(
    Object.keys(copy),
    keys,
    `${locale}: every recovery state is translated`,
  );
  for (const value of Object.values(copy)) {
    const text = typeof value === "function" ? value(3) : value;
    assert(text.length > 0);
    if (typeof value === "function") assert(text.includes("3"));
  }
  assert(
    copy.coordinatesRejected.includes(
      GRAPH_MAX_ABS_COORDINATE.toLocaleString("en-US"),
    ),
  );
  const renderRecovery = (state: StorageSnapshot) =>
    renderToStaticMarkup(
      <I18nProvider initialLocale={locale}>
        <StorageNoticeContent
          state={state}
          error={null}
          onDownload={() => {}}
          onRetry={() => {}}
          onLoad={() => {}}
          onDownloadOriginal={() => {}}
        />
      </I18nProvider>,
    );
  for (const { name, state, actions } of recoveryCases) {
    const html = renderRecovery(state);
    if (actions.length === 0) {
      assert.equal(html, "", `${locale}/${name}: no recovery notice is needed`);
      continue;
    }
    const buttons = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? [];
    assert.equal(
      buttons.length,
      actions.length,
      `${locale}/${name}: recovery actions are separate buttons`,
    );
    for (const action of actionKeys) {
      assert.equal(
        buttons.some((button) => button.includes(escapedText(copy[action]))),
        actions.includes(action),
        `${locale}/${name}: ${action} is shown only when available`,
      );
    }
    for (const [action, hint] of [
      ["backup", copy.backupHint],
      ["load", copy.loadHint],
    ] as const) {
      if (!actions.includes(action)) continue;
      const button = buttons.find((markup) =>
        markup.includes(escapedText(copy[action])),
      )!;
      const descriptionId = button.match(/aria-describedby="([^"]+)"/)?.[1];
      assert(
        descriptionId,
        `${locale}/${name}: ${action} has an accessible explanation`,
      );
      const description = html
        .match(/<p\b[^>]*>[\s\S]*?<\/p>/g)
        ?.find((markup) => markup.includes(`id="${descriptionId}"`));
      assert(
        description?.includes(escapedText(hint)),
        `${locale}/${name}: ${action} refers to its own accessible explanation`,
      );
      assert(
        description?.includes('class="sr-only"'),
        `${locale}/${name}: ${action} detail does not add a visible caption`,
      );
      assert(
        button.includes(`data-tooltip="${escapedText(hint)}"`),
        `${locale}/${name}: ${action} detail is available on hover or keyboard focus`,
      );
    }
    const visibleParagraphs = (
      html.match(/<p\b[^>]*>[\s\S]*?<\/p>/g) ?? []
    ).filter((markup) => !markup.includes('class="sr-only"'));
    assert.equal(
      visibleParagraphs.length,
      1,
      `${locale}/${name}: recovery uses one visible explanation`,
    );
    if (state.status !== "conflict") {
      assert(
        html.includes(escapedText(copy[state.status])),
        `${locale}/${name}: the storage problem is explained`,
      );
    } else {
      const explanation =
        state.raw === null
          ? copy.conflictDeleted
          : name === "conflict-invalid"
            ? copy.conflictInvalid
            : copy.conflict;
      assert(
        visibleParagraphs[0]!.includes(escapedText(explanation)),
        `${locale}/${name}: the short explanation describes the actual conflict`,
      );
      assert.equal(
        html.includes(escapedText(copy.loadHint)),
        actions.includes("load"),
        `${locale}/${name}: graph replacement and Undo are explained only for switching`,
      );
    }
    assert(
      html.includes(escapedText(copy.backupHint)),
      `${locale}/${name}: download details explain the JSON file`,
    );
    assert(
      !html.includes("broken"),
      `${locale}/${name}: original data is never displayed as UI copy`,
    );
  }
  assert.notEqual(
    renderRecovery({ status: "conflict", raw: validStoredGraph }),
    renderRecovery({ status: "conflict", raw: "broken" }),
    `${locale}: unreadable external content has a distinct recovery notice`,
  );
  assert.notEqual(
    renderRecovery({ status: "conflict", raw: "broken" }),
    renderRecovery({ status: "conflict", raw: null }),
    `${locale}: deleted external content has a distinct recovery notice`,
  );
  const store = createStore();
  for (const reason of [
    "coordinate-range",
    "invalid-graph",
    "operation",
  ] as const) {
    store.set(commandErrorAtom, {
      reason,
      message: "Internal diagnostics must not determine localized copy",
    });
    const html = renderToStaticMarkup(
      <Provider store={store}>
        <I18nProvider initialLocale={locale}>
          <GraphCanvasProvider>
            <StorageNotice />
          </GraphCanvasProvider>
        </I18nProvider>
      </Provider>,
    );
    assert(
      html.includes(
        renderToStaticMarkup(
          <>
            {reason === "coordinate-range"
              ? copy.coordinatesRejected
              : copy.rejected}
          </>,
        ),
      ),
      `${locale}/${reason}: rendered explanation follows the typed reason`,
    );
    assert(
      html.includes(renderToStaticMarkup(<>{copy.backup}</>)),
      `${locale}: a recoverable backup remains available`,
    );
    assert(!html.includes("Internal diagnostics"));
  }
  store.set(commandErrorAtom, null);
  assert.equal(
    renderToStaticMarkup(
      <Provider store={store}>
        <I18nProvider initialLocale={locale}>
          <GraphCanvasProvider>
            <StorageNotice />
          </GraphCanvasProvider>
        </I18nProvider>
      </Provider>,
    ),
    "",
  );
}
assert.notEqual(integrityCopy["zh-Hans"].failed, integrityCopy.en.failed);
assert.notEqual(
  integrityCopy["zh-Hans"].renderFailed,
  integrityCopy.en.renderFailed,
);
assert.throws(
  () =>
    serializeGraphModel({
      ...createEmptyGraphModel(),
      nodes: [{ id: "a", label: "a".repeat(257), order: 0, x: 0, y: 0 }],
    }),
  (error) =>
    error instanceof GraphContractError && error.reason === "invalid-graph",
);
console.log(
  "Integrity feedback passed (three locales, every storage state, recovery actions, typed rejections and backup UI)",
);
