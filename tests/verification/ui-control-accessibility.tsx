import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import { OptionToggle, Slider } from "../../components/ui/controls";

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
    new RegExp(`<[^>]+\\sid="${escapedId}"[^>]*>(.*?)<\\/[^>]+>`),
  );
  assert(element, `accessible text reference ${id} resolves`);
  return element[1]!.replace(/<[^>]*>/g, "");
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

console.log(
  "Shared UI accessibility: visible slider labels, contextual values and checkbox descriptions passed",
);
