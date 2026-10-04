import { Provider, createStore } from "jotai";
import { act, Profiler } from "react";
import { createRoot } from "react-dom/client";

import { GraphCanvasProvider } from "../../features/graph-editor/canvas/GraphCanvasProvider";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import { I18nProvider } from "../../features/graph-editor/i18n/I18nProvider";
import {
  graphAtom,
  syncExternalGraphAtom,
} from "../../features/graph-editor/shell/state/graph-atoms";
import { SampleGalleryPane } from "../../features/graph-editor/ui/samples/SampleGalleryPane";

// The runner instruments card invocations in its in-memory build only.
const renderCounts = new Map<string, number>();
Object.assign(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: true,
  recordGalleryCardRender: (kind: string) =>
    renderCounts.set(kind, (renderCounts.get(kind) ?? 0) + 1),
});

export async function runSampleGalleryBenchmark(requireIsolation = true) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const store = createStore();
  let duration = 0;
  let applied = 0;
  let copiedText = "";
  const onSampleApplied = () => applied++;
  const originalClipboard = Object.getOwnPropertyDescriptor(
    navigator,
    "clipboard",
  );
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (text: string) => {
        copiedText = text;
      },
    },
  });

  // Model a gallery whose cards have all been visited. Avoid viewport-dependent
  // observer timing, while retaining real DOM, React and preview rendering.
  const originalObserver = globalThis.IntersectionObserver;
  globalThis.IntersectionObserver = class {
    constructor(private callback: IntersectionObserverCallback) {}
    observe(element: Element) {
      this.callback(
        [
          {
            isIntersecting: true,
            target: element,
          } as IntersectionObserverEntry,
        ],
        this as unknown as IntersectionObserver,
      );
    }
    disconnect() {}
    unobserve() {}
    takeRecords() {
      return [];
    }
    readonly root = null;
    readonly rootMargin = "0px";
    readonly thresholds = [0];
  } as unknown as typeof IntersectionObserver;

  const assert = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };
  const card = (kind: string) =>
    host.querySelector<HTMLFormElement>(`[data-sample-kind="${kind}"]`)!;
  const field = (kind: string, label: string) =>
    card(kind).querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
  const setField = async (
    element: HTMLInputElement | HTMLSelectElement,
    value: string,
  ) => {
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        element instanceof HTMLInputElement
          ? HTMLInputElement.prototype
          : HTMLSelectElement.prototype,
        "value",
      )!.set!.call(element, value);
      element.dispatchEvent(
        new Event(element instanceof HTMLInputElement ? "input" : "change", {
          bubbles: true,
        }),
      );
    });
  };
  const click = async (element: HTMLElement) => {
    await act(async () => element.click());
  };
  const search = () =>
    host.querySelector<HTMLInputElement>('input[type="search"]')!;
  const select = (label: string) =>
    host.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;
  try {
    await act(async () => {
      root.render(
        <Provider store={store}>
          <I18nProvider initialLocale="en">
            <GraphCanvasProvider>
              <Profiler
                id="gallery"
                onRender={(_id, _phase, actualDuration) => {
                  duration += actualDuration;
                }}
              >
                <SampleGalleryPane onSampleApplied={onSampleApplied} />
              </Profiler>
            </GraphCanvasProvider>
          </I18nProvider>
        </Provider>,
      );
    });
    const cardCount = host.querySelectorAll("[data-sample-kind]").length;
    const durations: number[] = [];
    const renderedCards: number[] = [];
    for (let index = 0; index < 15; index++) {
      renderCounts.clear();
      duration = 0;
      // Each edit must settle before the next measurement starts.
      // oxlint-disable-next-line no-await-in-loop
      await setField(field("path", "Nodes"), String(10 + (index % 2)));
      if (requireIsolation)
        assert(
          renderCounts.size === 1 && renderCounts.has("path"),
          "Editing a parameter must render only that sample card",
        );
      if (index >= 5) {
        durations.push(duration);
        renderedCards.push(renderCounts.size);
      }
    }
    assert(field("path", "Nodes").value === "10", "Latest input is retained");
    assert(
      card("path").querySelectorAll("svg circle").length === 10,
      "Preview follows input",
    );

    // Graph edits must not reset local generation options or rerender cards.
    renderCounts.clear();
    await act(async () => {
      store.set(
        syncExternalGraphAtom,
        createEmptyGraphModel({ directed: true }),
      );
    });
    const externalEditCards = renderCounts.size;
    if (requireIsolation)
      assert(externalEditCards === 0, "Gallery ignores external graph changes");
    assert(
      select("Direction").value === "false",
      "Local settings snapshot is retained",
    );

    await setField(select("Index"), "1");
    await setField(select("Direction"), "true");
    assert(
      card("path")
        .querySelector("[data-sample-stats]")
        ?.textContent?.includes("Directed") ?? false,
      "Generation settings update previews",
    );
    await click(
      card("path").querySelector<HTMLButtonElement>(
        'button[aria-label*="Copy edge list"]',
      )!,
    );
    assert(copiedText.split("\n")[0] === "10 9", "Copy uses latest size");
    assert(copiedText.split("\n")[1] === "1 2", "Copy uses latest index");

    await setField(search(), "cycle");
    assert(!card("path"), "Search filters cards");
    await setField(search(), "");
    assert(
      field("path", "Nodes").value === "10",
      "Search preserves configuration",
    );
    await setField(select("Category"), "algorithmic");
    assert(!card("path"), "Category filters cards");
    await setField(select("Category"), "all");
    assert(
      field("path", "Nodes").value === "10",
      "Category preserves configuration",
    );
    await click(
      card("path").querySelector<HTMLButtonElement>(
        'button[aria-label*="Reset parameters"]',
      )!,
    );
    assert(field("path", "Nodes").value === "6", "Reset retains its callback");
    await setField(field("path", "Nodes"), "13");
    await click(
      card("path").querySelector<HTMLButtonElement>('button[type="submit"]')!,
    );
    const graph = store.get(graphAtom);
    assert(
      graph.nodes.length === 13 && graph.edges.length === 12,
      "Create uses latest size",
    );
    assert(
      graph.settings.directed && graph.settings.indexBase === 1,
      "Create uses latest settings",
    );
    assert(applied === 1, "Create dispatches its callback");
    return {
      cardCount,
      medianMs: median(durations),
      maxMs: Math.max(...durations),
      renderedCardsPerEdit: Math.max(...renderedCards),
      externalEditCards,
      behaviorVerified: true,
    };
  } finally {
    await act(async () => root.unmount());
    host.remove();
    globalThis.IntersectionObserver = originalObserver;
    if (originalClipboard)
      Object.defineProperty(navigator, "clipboard", originalClipboard);
    else Reflect.deleteProperty(navigator, "clipboard");
  }
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

Object.assign(globalThis, { runSampleGalleryBenchmark });
