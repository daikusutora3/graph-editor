import { getRustKernelReady, runRustKernel } from "./rust-kernel";
import {
  MAX_IMPORT_EDGES,
  MAX_IMPORT_NODES,
  type ParsedLine,
} from "../io/import-utils";

type MatrixEntry = { source: number; target: number; value: number };
export type NumericImportMatrix = {
  size: number;
  isBinary: boolean;
  isSymmetric: boolean;
  hasZeroValue: boolean;
  hasWeightedValue: boolean;
  directedEdgeCount: number;
  undirectedEdgeCount: number;
} & (
  | { entries: MatrixEntry[]; values?: undefined }
  | { values: number[][]; entries?: undefined }
);

const encoder = new TextEncoder();
const headerLength = 8;

/** Large ASCII integer matrices are scanned from text in one kernel call.
 * Other Number syntax and Unicode separators retain the JS reader. Bytes use
 * the existing allocation ABI; no JS numeric dense matrix is prepared/copied. */
export function readRustNumericMatrix(
  lines: ParsedLine[],
): NumericImportMatrix | null {
  const size = lines.length;
  if (!getRustKernelReady() || size < 128 || size > MAX_IMPORT_NODES)
    return null;
  if (lines.some((line) => line.text.includes("\n"))) return null;
  const text = lines.map((line) => line.text).join("\n");
  // Reject other syntax before scanning/copying a potentially long integer
  // prefix in Wasm. This also retains inexpensive decimal/Unicode fallback.
  if (
    text.includes(".") ||
    text.includes("e") ||
    text.includes("E") ||
    /[^0-9+,\- \t\r\n\v\f]/.test(text)
  )
    return null;
  // Write directly into the existing ABI allocation shape; no intermediate
  // byte buffer or converted JS numeric rows are allocated for the Rust path.
  const data = new Float64Array(Math.ceil(text.length / 8));
  const { read, written } = encoder.encodeInto(
    text,
    new Uint8Array(data.buffer),
  );
  if (read !== text.length || written !== text.length) return null;
  const capacity = Math.min(size * size, MAX_IMPORT_EDGES * 2);
  const output = runRustKernel(
    "import_integer_matrix",
    [data],
    headerLength + capacity * 3,
    [written, size, capacity],
  );
  if (!output || output[0] !== 1) return null;
  if (typeof performance !== "undefined") {
    performance.clearMarks("graph-compute:import:wasm");
    performance.mark("graph-compute:import:wasm");
  }
  const count = Math.min(output[6]!, capacity);
  return {
    size,
    isBinary: output[1] === 1,
    isSymmetric: output[2] === 1,
    hasZeroValue: output[3] === 1,
    hasWeightedValue: output[4] === 1,
    directedEdgeCount: output[6]!,
    undirectedEdgeCount: output[7]!,
    entries: Array.from({ length: count }, (_, index) => ({
      source: output[headerLength + index * 3]!,
      target: output[headerLength + index * 3 + 1]!,
      value: output[headerLength + index * 3 + 2]!,
    })),
  };
}
