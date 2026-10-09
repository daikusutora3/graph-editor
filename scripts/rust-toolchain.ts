import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Use the repository's Rust installation when present, otherwise PATH. */
export function runCargo(args: string[]) {
  const localCargo = resolve(root, ".local-bin/rust/cargo/bin/cargo");
  const environment = { ...process.env };
  if (existsSync(localCargo)) {
    environment.CARGO_HOME = resolve(root, ".local-bin/rust/cargo");
    environment.RUSTUP_HOME = resolve(root, ".local-bin/rust/rustup");
  }
  return spawnSync(existsSync(localCargo) ? localCargo : "cargo", args, {
    cwd: resolve(root, "rust/graph-kernels"),
    env: environment,
    stdio: "inherit",
  });
}
