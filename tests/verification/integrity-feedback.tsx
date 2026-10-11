import assert from "node:assert/strict";
import { Provider, createStore } from "jotai";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "../../features/graph-editor/i18n/I18nProvider";
import { SUPPORTED_LOCALES } from "../../features/graph-editor/i18n/locale";
import { integrityCopy } from "../../features/graph-editor/i18n/integrity-copy";
import { GraphCanvasProvider } from "../../features/graph-editor/canvas/GraphCanvasProvider";
import { StorageNotice } from "../../features/graph-editor/ui/chrome/StorageNotice";
import { commandErrorAtom } from "../../features/graph-editor/shell/state/history-atoms";
import { GRAPH_MAX_ABS_COORDINATE } from "../../features/graph-editor/core/graph/graph-coordinates";
import {
  GraphContractError,
  serializeGraphModel,
} from "../../features/graph-editor/core/graph/graph-json";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";

const keys = Object.keys(integrityCopy.en);
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
  "Integrity feedback passed (all recovery keys, three locales, typed coordinate/general rejection, non-empty counts and backup UI)",
);
