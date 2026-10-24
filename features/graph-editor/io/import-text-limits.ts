import {
  GRAPH_MAX_TEXT_CODE_POINTS,
  isGraphText,
} from "../core/graph/graph-limits";
import type { ImportWarning } from "./import-types";

export function importTextLimitWarning(
  value: string,
  field: "node-label" | "edge-weight",
  line: number,
): ImportWarning | undefined {
  if (isGraphText(value as unknown)) return;

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
