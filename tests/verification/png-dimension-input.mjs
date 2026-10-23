import assert from "node:assert/strict";
import { mock } from "bun:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

let draft = null;
mock.module("react", () => ({
  ...React,
  useId: () => "png-dimension",
  useState: () => [draft, (next) => (draft = next)],
}));

const { TextInput } = await import("../../components/ui/controls.ts");
const { PngDimensionInput } =
  await import("../../features/graph-editor/ui/panels/PngDimensionInput.tsx");
let value = 1920;
const applied = [];
function render() {
  const tree = PngDimensionInput({
    label: "Width",
    value,
    onChange: (next) => {
      applied.push(next);
      value = next;
    },
  });
  const input = tree.props.children.props.children.find(
    (child) => child.type === TextInput,
  );
  return { tree, input: input.props };
}
function type(text) {
  render().input.onChange({ currentTarget: { value: text } });
  assert.equal(render().input.value, text, "typing keeps the editable draft");
}
function enter({ composing = false, keyCode = 13 } = {}) {
  let prevented = false;
  render().input.onKeyDown({
    key: "Enter",
    defaultPrevented: false,
    nativeEvent: { isComposing: composing, keyCode },
    preventDefault: () => (prevented = true),
  });
  return prevented;
}

type("");
assert.deepEqual(applied, [], "clearing does not change the exported size");
type("640");
assert.deepEqual(applied, [], "typing waits for an explicit commit");
render().input.onBlur();
assert.equal(value, 640, "blur applies a replacement size");
assert.equal(render().input.value, "640");

type("");
render().input.onBlur();
assert.equal(value, 640, "an empty draft restores the last usable size");
assert.equal(render().input.value, "640");

for (const [text, expected] of [
  ["99999", 3840],
  ["0", 1],
  ["-12", 1],
  ["2.5", 3],
  ["1e3", 1000],
  ["Infinity", 1000],
]) {
  type(text);
  assert(enter(), "Enter commits the draft");
  assert.equal(value, expected, `${text} normalizes to a safe pixel size`);
  assert.equal(render().input.value, String(expected));
}

type("1280");
assert.equal(enter({ composing: true }), false);
assert.equal(value, 1000, "IME confirmation does not commit the size");
assert.equal(enter({ keyCode: 229 }), false);
assert.equal(render().input.value, "1280");
assert(enter());
assert.equal(value, 1280);

value = 1080;
assert.equal(
  render().input.value,
  "1080",
  "external size updates remain visible",
);
const markup = renderToStaticMarkup(render().tree);
assert(markup.includes('for="png-dimension"'));
assert(markup.includes('id="png-dimension"'));
assert(markup.includes('aria-describedby="png-dimension-range"'));
assert(markup.includes('id="png-dimension-range"'));
assert(markup.includes("1–3840 px"), "the unit and range remain visible");

console.log(
  "PNG dimensions: draft replacement, commit, safe bounds, IME and label support passed",
);
