import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(
  new URL("../../app/globals.css", import.meta.url),
  "utf8",
);

function tokens(selector: string) {
  const block = css.slice(css.indexOf(selector)).split("}")[0]!;
  return new Map(
    [...block.matchAll(/(--[\w-]+):\s*(#[\da-f]{6});/gi)].map((match) => [
      match[1]!,
      match[2]!,
    ]),
  );
}

function luminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

function contrast(first: string, second: string) {
  const values = [luminance(first), luminance(second)].sort((a, b) => a - b);
  return (values[1]! + 0.05) / (values[0]! + 0.05);
}

for (const theme of ["light", "dark"]) {
  const palette = tokens(`:root[data-theme="${theme}"]`);
  function requireContrast(
    foreground: string,
    background: string,
    minimum: number,
  ) {
    const first = palette.get(foreground);
    const second = palette.get(background);
    assert(first && second, `${theme}: ${foreground} and ${background} exist`);
    const ratio = contrast(first, second);
    assert(
      ratio >= minimum,
      `${theme}: ${foreground} on ${background}: ${ratio.toFixed(2)} < ${minimum}`,
    );
  }

  for (const background of ["--bg", "--panel-solid", "--fill"]) {
    for (const foreground of ["--text", "--text-2", "--muted", "--faint"]) {
      requireContrast(foreground, background, 4.5);
    }
    requireContrast("--control-border", background, 3);
    requireContrast("--control-accent", background, 3);
    requireContrast("--focus", background, 3);
  }
  requireContrast("--primary-text", "--primary", 4.5);
  requireContrast("--focus", "--fill-2", 3);
}

console.log(
  "Design palette: text, control boundaries and keyboard focus contrast passed in both themes",
);
