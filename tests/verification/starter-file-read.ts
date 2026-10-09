import {
  GRAPH_MAX_INPUT_CHARS,
  GRAPH_MAX_JSON_CHARS,
} from "../../features/graph-editor/core/graph/graph-limits";
import type { ImportFormat } from "../../features/graph-editor/io/import-utils";
import {
  createStarterFileReader,
  IDLE_FILE_READ_STATE,
  type StarterFileReadState,
} from "../../features/graph-editor/workflows/starter/starter-file-read";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("Starter file read");

function deferredFile(size = 8) {
  let resolve!: (text: string) => void;
  let reject!: (error: Error) => void;
  const result = new Promise<string>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { file: { size, text: () => result }, resolve, reject };
}

function session(
  initialInput = "existing input",
  initialFormat: ImportFormat = "auto",
) {
  let input = initialInput;
  let format = initialFormat;
  let state: StarterFileReadState = IDLE_FILE_READ_STATE;
  const accepted: string[] = [];
  const reader = createStarterFileReader({
    getFormat: () => format,
    onInput: (text) => {
      input = text;
      accepted.push(text);
    },
    onState: (next) => {
      state = next;
    },
  });

  return {
    ...reader,
    accepted,
    snapshot: () => ({ input, state }),
    edit: (text: string) => {
      reader.invalidate();
      input = text;
    },
    format: (next: ImportFormat) => {
      format = next;
    },
  };
}

// Resolve in the opposite order to selection; the second file wins.
{
  const current = session();
  const first = deferredFile();
  const second = deferredFile();
  const firstRead = current.read(first.file);
  const secondRead = current.read(second.file);
  expect(
    current.snapshot().state.status === "reading",
    "pending read is visible",
  );
  second.resolve("second file");
  await secondRead;
  first.resolve("older first file");
  await firstRead;
  expect(
    current.snapshot().input === "second file",
    "older completion cannot replace newer file",
  );
  expect(
    current.accepted.length === 1,
    "obsolete file is never delivered to input",
  );
  expect(
    current.snapshot().state.status === "idle",
    "latest successful read clears pending state",
  );
}

// Typing is newer user intent even while File.text is still pending.
{
  const current = session();
  const file = deferredFile();
  const reading = current.read(file.file);
  current.edit("new manual input");
  file.resolve("older file input");
  await reading;
  expect(
    current.snapshot().input === "new manual input",
    "manual input survives pending completion",
  );
  expect(
    current.snapshot().state.status === "idle",
    "manual editing cancels read status",
  );
}

// Closing and reopening invalidate the previous session before the next read.
{
  const current = session();
  const old = deferredFile();
  const oldRead = current.read(old.file);
  current.invalidate();
  current.edit("");
  const next = deferredFile();
  const nextRead = current.read(next.file);
  old.resolve("previous session");
  await oldRead;
  expect(
    current.snapshot().input === "",
    "closed session cannot refill reopened empty input",
  );
  expect(
    current.snapshot().state.status === "reading",
    "obsolete completion cannot clear the new pending read",
  );
  next.resolve("reopened session");
  await nextRead;
  expect(
    current.snapshot().input === "reopened session",
    "reopened session accepts its own file",
  );
}

// Rejection must be handled, and only the latest request may display an error.
{
  const current = session();
  const old = deferredFile();
  const oldRead = current.read(old.file);
  await current.read(new File(["latest"], "latest.txt"));
  old.reject(new Error("obsolete failure"));
  await oldRead;
  expect(
    current.snapshot().input === "latest",
    "obsolete read failure preserves current input",
  );
  expect(
    current.snapshot().state.status === "idle",
    "obsolete error is not displayed",
  );

  let attempts = 0;
  const retryFile = {
    size: 8,
    text: async () => {
      if (++attempts === 1) throw new Error("read failed");
      return "retried";
    },
  };
  await current.read(retryFile);
  const failed = current.snapshot();
  expect(failed.input === "latest", "read failure retains prior input");
  expect(
    failed.state.status === "failed" && failed.state.reason === "unreadable",
    "latest failure has a recoverable error state",
  );
  await current.read(retryFile);
  expect(
    current.snapshot().input === "retried",
    "same file object can be selected again after failure",
  );
  expect(attempts === 2, "same file retry starts a fresh read");
}

// The byte limit runs before allocating the entire decoded string.
await Promise.all(
  (["auto", "json", "edge-pairs"] as const).map(async (format) => {
    const limit =
      format === "edge-pairs" ? GRAPH_MAX_INPUT_CHARS : GRAPH_MAX_JSON_CHARS;
    const current = session("retained", format);
    let reads = 0;
    await current.read({
      size: limit * 3 + 4,
      text: async () => {
        reads += 1;
        return "unreachable";
      },
    });
    const failed = current.snapshot();
    expect(
      reads === 0,
      `${format}: oversized file is rejected before File.text`,
    );
    expect(
      failed.input === "retained",
      `${format}: oversized file retains input`,
    );
    expect(
      failed.state.status === "failed" &&
        failed.state.reason === "too-large" &&
        failed.state.limit === limit,
      `${format}: size error reports existing character contract`,
    );
  }),
);

// Real UTF-8 files exercise the boundary where byte count exceeds text length.
const jsonPrefix = '{"value":"';
const jsonSuffix = '"}';
const exactJson =
  jsonPrefix +
  "界".repeat(GRAPH_MAX_JSON_CHARS - jsonPrefix.length - jsonSuffix.length) +
  jsonSuffix;
{
  const current = session();
  const unicodeFile = new File(
    [new Uint8Array([0xef, 0xbb, 0xbf]), exactJson],
    "unicode.json",
  );
  expect(
    unicodeFile.size > GRAPH_MAX_JSON_CHARS,
    "valid CJK file exceeds a naive byte-to-character cap",
  );
  await current.read(unicodeFile);
  expect(
    current.snapshot().input === exactJson,
    "auto JSON accepts exactly two million UTF-16 units with UTF-8 BOM",
  );
  expect(
    current.snapshot().state.status === "idle",
    "valid Unicode boundary produces no read error",
  );
}

await Promise.all(
  (["auto", "json"] as const).map(async (format) => {
    const current = session("retained", format);
    await current.read(new File([exactJson + " "], "too-long.json"));
    const failed = current.snapshot();
    expect(
      failed.input === "retained",
      `${format}: JSON character overflow retains input`,
    );
    expect(
      failed.state.status === "failed" &&
        failed.state.reason === "too-large" &&
        failed.state.limit === GRAPH_MAX_JSON_CHARS,
      `${format}: JSON uses the existing two-million-unit limit`,
    );
  }),
);

await Promise.all(
  (["auto", "edge-pairs"] as const).map(async (format) => {
    const current = session("retained", format);
    const boundary = "界".repeat(GRAPH_MAX_INPUT_CHARS);
    const exactFile = new File(
      [new Uint8Array([0xef, 0xbb, 0xbf]), boundary],
      "exact-text.txt",
    );
    expect(
      exactFile.size === GRAPH_MAX_INPUT_CHARS * 3 + 3,
      `${format}: fixture reaches the inclusive UTF-8 byte boundary`,
    );
    await current.read(exactFile);
    expect(
      current.snapshot().input === boundary,
      `${format}: text accepts exactly one million UTF-16 units`,
    );
    await current.read(new File([boundary + "a"], "too-long.txt"));
    const failed = current.snapshot();
    expect(
      failed.input === boundary,
      `${format}: text overflow retains accepted boundary input`,
    );
    expect(
      failed.state.status === "failed" &&
        failed.state.reason === "too-large" &&
        failed.state.limit === GRAPH_MAX_INPUT_CHARS,
      `${format}: plain text keeps the existing one-million-unit limit`,
    );
  }),
);

// Format selection during reading controls the decoded-text contract.
{
  const current = session("retained", "edge-pairs");
  const asciiJson = exactJson.replaceAll("界", "a");
  const pending = deferredFile(new Blob([asciiJson]).size);
  const reading = current.read(pending.file);
  current.format("json");
  pending.resolve(asciiJson);
  await reading;
  expect(
    current.snapshot().input === asciiJson,
    "completion honors the current JSON selection",
  );
}

// A newer rejected selection must also prevent an older valid read from winning.
{
  const current = session("retained");
  const old = deferredFile();
  const oldRead = current.read(old.file);
  await current.read({
    size: GRAPH_MAX_JSON_CHARS * 3 + 4,
    text: async () => "unreachable",
  });
  old.resolve("obsolete valid file");
  await oldRead;
  const failed = current.snapshot();
  expect(
    failed.input === "retained",
    "older read cannot replace input after a rejected newer file",
  );
  expect(
    failed.state.status === "failed" && failed.state.reason === "too-large",
    "older completion preserves the newer file error",
  );
}

// A canceled native chooser does not erase input or interfere with a read.
{
  const current = session();
  const pending = deferredFile();
  const reading = current.read(pending.file);
  await current.read(undefined);
  expect(
    current.snapshot().state.status === "reading",
    "canceled chooser preserves pending read",
  );
  pending.resolve("selected file");
  await reading;
  expect(
    current.snapshot().input === "selected file",
    "pending selection survives a canceled chooser",
  );
}

finish();
