import {
  GRAPH_MAX_TEXT_CODE_POINTS,
  isGraphText,
} from "../core/graph/graph-limits";
import type { ImportWarning } from "./import-types";

/** Check decoded graph fields, rather than raw tokens that include syntax. */
export function importTextLimitWarning(
  value: string,
  field: "node-label" | "edge-weight",
  line: number,
): ImportWarning | undefined {
  // Its public type guard accepts unknown; a rejected string still needs a count.
  if (isGraphText(value as unknown)) return;
  // Count only rejected text; valid short fields use the shared fast path.
  let count = 0;
  for (let index = 0; index < value.length; index += 1) {
    count += 1;
    if (value.codePointAt(index)! > 0xffff) index += 1;
  }
  return {
    code: "text-too-long",
    field,
    line,
    count,
    limit: GRAPH_MAX_TEXT_CODE_POINTS,
  };
}
