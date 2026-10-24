import { spawnSync } from "node:child_process";
import { isPublicCommitEmail } from "./privacy-check-core";

function git(args: string[], required = true) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (required && result.status !== 0)
    throw new Error("Git configuration failed");
  return result.status === 0 ? result.stdout.trim() : "";
}

try {
  const args = process.argv.slice(2);
  const options = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    if (!["--email", "--name"].includes(args[index]) || !args[index + 1]) {
      throw new Error(
        "Use privacy:setup [--email <GitHub-noreply-address>] [--name <public-alias>]",
      );
    }
    options.set(args[index], args[index + 1]);
  }
  const previousEmail = git(["config", "user.email"], false);
  const previousName = git(["config", "user.name"], false);
  const email = options.get("--email") ?? previousEmail;
  if (!isPublicCommitEmail(email)) {
    throw new Error(
      "Provide your GitHub noreply address using --email; no configuration was changed",
    );
  }
  const name =
    options.get("--name") ?? email.split("@")[0].replace(/^\d+\+/, "");
  if (!/^[a-z0-9][a-z0-9-]*(?:\[bot\])?$/i.test(name)) {
    throw new Error(
      "Provide a public account alias using --name; no configuration was changed",
    );
  }
  const blocked = git(
    ["config", "--local", "--get-all", "privacy.blockedPattern"],
    false,
  ).split("\n");
  for (const value of [
    previousEmail && !isPublicCommitEmail(previousEmail) ? previousEmail : "",
    /\s/.test(previousName) && previousName !== name ? previousName : "",
  ]) {
    if (
      value &&
      !blocked.some(
        (existing) => existing.toLowerCase() === value.toLowerCase(),
      )
    ) {
      git(["config", "--local", "--add", "privacy.blockedPattern", value]);
    }
  }
  const allowed = git(
    ["config", "--local", "--get-all", "privacy.allowedEmail"],
    false,
  ).split("\n");
  if (!allowed.some((value) => value.toLowerCase() === email.toLowerCase())) {
    git(["config", "--local", "--add", "privacy.allowedEmail", email]);
  }
  git(["config", "--local", "user.useConfigOnly", "true"]);
  git(["config", "--local", "user.name", name]);
  git(["config", "--local", "user.email", email]);
  git(["config", "--local", "core.hooksPath", ".githooks"]);
  console.log(
    "Repository-local public identity and privacy hooks configured. Previous private values were not printed.",
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Privacy setup failed",
  );
  process.exit(1);
}
