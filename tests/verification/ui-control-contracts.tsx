import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ActionRow,
  Button,
  ChoiceButton,
  ControlRow,
  OptionToggle,
  PanelActions,
  Segment,
  TextInput,
} from "../../components/ui/controls";

function openingTags(markup: string, tag: string) {
  return [...markup.matchAll(new RegExp(`<${tag}\\b[^>]*>`, "g"))].map(
    (match) => match[0],
  );
}

function attribute(tag: string, name: string) {
  return tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
}

function textContent(markup: string) {
  return markup.replace(/<[^>]*>/g, "");
}

const options = [
  { label: "Undirected", value: "undirected" },
  { label: "Directed", value: "directed" },
] as const;

for (const value of options.map((option) => option.value)) {
  for (const disabled of [false, true]) {
    const markup = renderToStaticMarkup(
      <Segment
        label="Direction"
        options={options}
        value={value}
        disabled={disabled}
        onChange={() => {}}
      />,
    );
    const group = openingTags(markup, "div").find(
      (tag) => attribute(tag, "role") === "radiogroup",
    );
    assert(group, "exclusive choices have a radio group");
    assert.equal(attribute(group, "aria-label"), "Direction");

    const radios = openingTags(markup, "button");
    assert.equal(radios.length, options.length);
    radios.forEach((radio, index) => {
      const option = options[index]!;
      const selected = option.value === value;
      assert.equal(attribute(radio, "type"), "button");
      assert.equal(attribute(radio, "role"), "radio");
      assert.equal(
        attribute(radio, "aria-label"),
        `Direction: ${option.label}`,
      );
      assert.equal(attribute(radio, "aria-checked"), String(selected));
      assert.equal(attribute(radio, "tabindex"), selected ? "0" : "-1");
      assert.equal(attribute(radio, "disabled") !== undefined, disabled);
    });
  }
}

for (const checked of [false, true]) {
  for (const disabled of [false, true]) {
    const markup = renderToStaticMarkup(
      <OptionToggle
        checked={checked}
        disabled={disabled}
        label="Grid snapping"
        onChange={() => {}}
      />,
    );
    const button = openingTags(markup, "button")[0]!;
    assert.equal(attribute(button, "type"), "button");
    assert.equal(attribute(button, "role"), "checkbox");
    assert.equal(attribute(button, "aria-checked"), String(checked));
    assert.equal(attribute(button, "disabled") !== undefined, disabled);
    assert(textContent(markup).includes("Grid snapping"));
  }
}

const field = renderToStaticMarkup(
  <ControlRow label="Width" htmlFor="canvas-width">
    <TextInput id="canvas-width" type="number" />
  </ControlRow>,
);
assert.equal(attribute(openingTags(field, "label")[0]!, "for"), "canvas-width");
assert.equal(attribute(openingTags(field, "input")[0]!, "id"), "canvas-width");
assert(textContent(field).includes("Width"));

const choice = renderToStaticMarkup(
  <ChoiceButton aria-pressed={false} aria-disabled>
    Tree layout
  </ChoiceButton>,
);
const choiceButton = openingTags(choice, "button")[0]!;
assert.equal(attribute(choiceButton, "type"), "button");
assert.equal(attribute(choiceButton, "role"), undefined);
assert.equal(attribute(choiceButton, "aria-pressed"), "false");
assert.equal(attribute(choiceButton, "aria-disabled"), "true");
assert.equal(attribute(choiceButton, "disabled"), undefined);
assert.equal(textContent(choice), "Tree layout");

const action = renderToStaticMarkup(
  <ActionRow aria-label="Clear graph" trailing="Twice to confirm">
    Clear
  </ActionRow>,
);
const actionButton = openingTags(action, "button")[0]!;
assert.equal(attribute(actionButton, "type"), "button");
assert.equal(attribute(actionButton, "aria-label"), "Clear graph");
assert(textContent(action).includes("Clear"));
assert(textContent(action).includes("Twice to confirm"));

const actions = renderToStaticMarkup(
  <PanelActions>
    <Button>Save</Button>
    <Button>Copy</Button>
  </PanelActions>,
);
const actionLabels = [...actions.matchAll(/<button\b[^>]*>.*?<\/button>/g)].map(
  (match) => textContent(match[0]),
);
assert.deepEqual(actionLabels, ["Save", "Copy"]);

console.log(
  "Shared UI: names, selection, focus stops and action semantics passed",
);
