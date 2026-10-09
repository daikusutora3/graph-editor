import { looksLikeGraphJson } from "../../core/graph/graph-json";
import {
  GRAPH_MAX_INPUT_CHARS,
  GRAPH_MAX_JSON_CHARS,
} from "../../core/graph/graph-limits";
import type { ImportFormat } from "../../io/import-utils";

export type StarterFileReadState =
  | { status: "idle" }
  | { status: "reading" }
  | { status: "failed"; reason: "unreadable" }
  | { status: "failed"; reason: "too-large"; limit: number };

export const IDLE_FILE_READ_STATE: StarterFileReadState = { status: "idle" };

type GraphInputFile = Pick<File, "size" | "text">;

/** Protect the input from older file reads, edits and closed starter sessions. */
export function createStarterFileReader({
  getFormat,
  onInput,
  onState,
}: {
  getFormat: () => ImportFormat;
  onInput: (text: string) => void;
  onState: (state: StarterFileReadState) => void;
}) {
  let generation = 0;

  const invalidate = () => {
    generation += 1;
    onState(IDLE_FILE_READ_STATE);
  };

  const read = async (file: GraphInputFile | undefined) => {
    if (!file) return;
    const request = ++generation;
    const format = getFormat();
    const maximumChars =
      format === "auto" || format === "json"
        ? GRAPH_MAX_JSON_CHARS
        : GRAPH_MAX_INPUT_CHARS;
    // File.text() decodes UTF-8. A valid UTF-16 unit can require at most three
    // UTF-8 bytes; also allow the three-byte BOM that decoding removes.
    // A byte cap equal to the character cap would reject valid CJK input.
    if (file.size > maximumChars * 3 + 3) {
      onState({ status: "failed", reason: "too-large", limit: maximumChars });
      return;
    }

    onState({ status: "reading" });
    try {
      const text = await file.text();
      if (request !== generation) return;
      const currentFormat = getFormat();
      const limit =
        currentFormat === "json" ||
        (currentFormat === "auto" && looksLikeGraphJson(text))
          ? GRAPH_MAX_JSON_CHARS
          : GRAPH_MAX_INPUT_CHARS;
      if (text.length > limit) {
        onState({ status: "failed", reason: "too-large", limit });
        return;
      }

      onInput(text);
      onState(IDLE_FILE_READ_STATE);
    } catch {
      if (request === generation)
        onState({ status: "failed", reason: "unreadable" });
    }
  };

  return { invalidate, read };
}
