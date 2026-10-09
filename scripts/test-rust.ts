import { runCargo } from "./rust-toolchain";

const result = runCargo(["test", "--offline", "--locked"]);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
