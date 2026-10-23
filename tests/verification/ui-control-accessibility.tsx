import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import { OptionToggle, Slider } from "../../components/ui/controls";
import { ExportPanelFooter } from "../../features/graph-editor/ui/panels/ExportPanel";
import { inputGuidanceCopy } from "../../features/graph-editor/i18n/input-guidance-copy";
import {
  createEdge,
  createEmptyGraphModel,
  createNode,
} from "../../features/graph-editor/core/graph/graph-factory";
import { I18nProvider } from "../../features/graph-editor/i18n/I18nProvider";
import { SUPPORTED_LOCALES } from "../../features/graph-editor/i18n/locale";
import { messagesByLocale } from "../../features/graph-editor/i18n/messages";
import { LayoutsPanel } from "../../features/graph-editor/ui/panels/LayoutsPanel";

function openingTags(markup: string, tag: string) {
  return [...markup.matchAll(new RegExp(`<${tag}\\b[^>]*>`, "g"))].map(
    (match) => match[0],
  );
}

function attribute(tag: string, name: string) {
  return tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
}

function referencedText(markup: string, id: string | undefined) {
  assert(id, "accessible text references have an ID");
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const element = markup.match(
    new RegExp(
      `<([a-z][a-z0-9]*)\\b[^>]*\\sid="${escapedId}"[^>]*>(.*?)<\\/\\1>`,
    ),
  );
  assert(element, `accessible text reference ${id} resolves`);
  return element[2]!.replace(/<[^>]*>/g, "");
}

// Both PNG controls have numeric presets. Their names must still identify the
// setting and its unit when reached directly in a screen reader's button list.
const sliders = renderToStaticMarkup(
  <>
    <Slider
      label="Image size"
      name="image-size"
      min={100}
      max={1000}
      step={100}
      value={400}
      presets={[200, 800]}
      onChange={() => {}}
    />
    <Slider
      label="Padding"
      name="padding"
      min={0}
      max={100}
      step={1}
      value={20}
      unit=""
      presets={[10, 20]}
      onChange={() => {}}
    />
  </>,
);
const ranges = openingTags(sliders, "input");
const labels = openingTags(sliders, "label");
assert.equal(ranges.length, 2);
assert.equal(labels.length, 2);
ranges.forEach((range, index) => {
  assert.equal(attribute(range, "type"), "range");
  assert.equal(attribute(labels[index]!, "for"), attribute(range, "id"));
});
assert.equal(attribute(ranges[0]!, "aria-valuetext"), "400 px");
assert.equal(attribute(ranges[1]!, "aria-valuetext"), "20");
assert.deepEqual(
  openingTags(sliders, "button").map((button) =>
    attribute(button, "aria-label"),
  ),
  ["Image size: 200 px", "Image size: 800 px", "Padding: 10", "Padding: 20"],
);

const toggles = renderToStaticMarkup(
  <>
    <OptionToggle
      checked
      label="Grid snapping"
      description="Align nodes with the grid while dragging."
      icon={
        <svg>
          <title>Decorative grid</title>
        </svg>
      }
      onChange={() => {}}
    />
    <OptionToggle checked={false} label="Node labels" onChange={() => {}} />
  </>,
);
const checkboxes = openingTags(toggles, "button");
assert.equal(checkboxes.length, 2);
assert.equal(
  referencedText(toggles, attribute(checkboxes[0]!, "aria-labelledby")),
  "Grid snapping",
);
assert.equal(
  referencedText(toggles, attribute(checkboxes[0]!, "aria-describedby")),
  "Align nodes with the grid while dragging.",
);
assert.equal(
  referencedText(toggles, attribute(checkboxes[1]!, "aria-labelledby")),
  "Node labels",
);
assert.notEqual(
  attribute(checkboxes[0]!, "aria-labelledby"),
  attribute(checkboxes[1]!, "aria-labelledby"),
  "multiple toggles retain separate accessible names",
);
assert.equal(attribute(checkboxes[1]!, "aria-describedby"), undefined);

for (const locale of SUPPORTED_LOCALES) {
  for (const copyState of ["idle", "copied", "blocked"] as const) {
    const markup = renderToStaticMarkup(
      <I18nProvider initialLocale={locale}>
        <ExportPanelFooter
          copyState={copyState}
          disabled={false}
          extension="txt"
          onCopy={() => {}}
          onSaveTxt={() => {}}
        />
      </I18nProvider>,
    );
    const status = openingTags(markup, "p").find(
      (tag) => attribute(tag, "role") === "status",
    );
    assert(status, "copy results use a persistent status region");
    assert.equal(attribute(status, "aria-atomic"), "true");
    const statusId = attribute(status, "id");
    const text = referencedText(markup, statusId);
    assert.equal(
      text,
      copyState === "blocked"
        ? inputGuidanceCopy[locale].copyFailure
        : copyState === "copied"
          ? inputGuidanceCopy[locale].copySuccess
          : "",
    );
    if (copyState === "blocked") {
      assert.equal(
        attribute(openingTags(markup, "button")[1]!, "aria-describedby"),
        statusId,
        "retrying Copy retains recovery guidance",
      );
    }
  }
  const copy = messagesByLocale[locale];
  const empty = createEmptyGraphModel();
  const triangle = {
    ...empty,
    nodes: [0, 1, 2].map((order) => createNode({ id: String(order), order })),
    edges: [
      createEdge({ id: "a", source: "0", target: "1" }),
      createEdge({ id: "b", source: "1", target: "2" }),
      createEdge({ id: "c", source: "2", target: "0" }),
    ],
  };
  for (const graph of [empty, triangle]) {
    const markup = renderToStaticMarkup(
      <I18nProvider initialLocale={locale}>
        <LayoutsPanel
          graph={graph}
          onApplyLayout={() => {}}
          onToggleOffsetEdges={() => {}}
        />
      </I18nProvider>,
    );
    const buttons = openingTags(markup, "button");
    const disabled = buttons.filter(
      (button) => attribute(button, "aria-disabled") === "true",
    );
    assert(disabled.length > 0);
    for (const button of disabled) {
      const reason = referencedText(
        markup,
        attribute(button, "aria-describedby"),
      );
      assert(reason, `${locale}: disabled layouts have a visible explanation`);
      assert(
        Object.values(copy.layouts.disabled).some((text) =>
          reason.includes(text),
        ),
        `${locale}: disabled layout explanation uses localized requirements`,
      );
    }
    for (const button of buttons.filter(
      (tag) => attribute(tag, "aria-disabled") !== "true",
    )) {
      assert.equal(attribute(button, "aria-describedby"), undefined);
    }
    if (graph === empty) {
      assert.equal(
        openingTags(markup, "li").length,
        1,
        `${locale}: empty layouts share a single visible reason`,
      );
    }
  }
}

console.log(
  "Shared UI accessibility: labels, contextual values, descriptions and visible layout requirements passed",
);
