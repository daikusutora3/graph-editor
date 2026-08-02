#!/usr/bin/env python3
"""Deny GitHub Issue operations before a Codex tool is executed."""

from __future__ import annotations

import json
import re
import sys
from typing import Any


DENIAL_REASON = (
    "Blocked by this repository's policy: GitHub Issue operations are disabled."
)

GITHUB_ISSUE_URL = re.compile(
    r"https?://(?:api\.)?github\.com/"
    r"(?:repos/)?[^\s/'\"?]+/[^\s/'\"?]+/issues(?:[/\s?'\"#]|$)",
    re.IGNORECASE,
)
GH_ISSUE_COMMAND = re.compile(
    r"\bgh\s+(?:issue\b|search\s+issues\b)", re.IGNORECASE
)
GH_API_COMMAND = re.compile(r"\bgh\s+api\b", re.IGNORECASE)
GITHUB_HTTP_COMMAND = re.compile(
    r"\b(?:curl|wget|http|https|open)\b[^\n]*(?:api\.)?github\.com",
    re.IGNORECASE,
)
ISSUE_API_SIGNAL = re.compile(
    r"(?:/issues(?:[/\s?'\"#]|$)|\bissue_number\b|\bissueNumber\b|"
    r"\b(?:issue|issues)\s*\(|\b(?:create|update|close|reopen|delete|lock|unlock|"
    r"transfer|pin|unpin)Issue\b)",
    re.IGNORECASE,
)


def _compact_json(value: Any) -> str:
    try:
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    except (TypeError, ValueError):
        return str(value)


def _command_from(tool_input: Any) -> str:
    if not isinstance(tool_input, dict):
        return str(tool_input or "")
    command = tool_input.get("command", tool_input.get("cmd", ""))
    if isinstance(command, list):
        return " ".join(str(part) for part in command)
    return str(command or "")


def should_block(tool_name: str, tool_input: Any) -> bool:
    """Return True only for tool calls that can access or mutate Issues."""

    name = tool_name.casefold()
    payload = _compact_json(tool_input)

    # Dedicated GitHub Issue tools are unambiguous. This covers MCP tools such
    # as mcp__github__issue_read and future connector naming variants.
    if "github" in name and "issue" in name:
        return True

    if name == "bash":
        command = _command_from(tool_input)
        if GH_ISSUE_COMMAND.search(command) or GITHUB_ISSUE_URL.search(command):
            return True
        if GH_API_COMMAND.search(command) and ISSUE_API_SIGNAL.search(command):
            return True
        if GITHUB_HTTP_COMMAND.search(command) and ISSUE_API_SIGNAL.search(command):
            return True
        return False

    # Generic GitHub API/GraphQL tools often put the operation in their JSON
    # arguments instead of their tool name.
    if "github" in name and ISSUE_API_SIGNAL.search(payload):
        return True

    # Browser and computer-use navigation must not open an Issue URL either.
    if any(marker in name for marker in ("browser", "chrome", "computer")):
        return bool(GITHUB_ISSUE_URL.search(payload))

    return False


def deny() -> None:
    json.dump(
        {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": DENIAL_REASON,
            }
        },
        sys.stdout,
        ensure_ascii=False,
    )


def self_test() -> None:
    blocked = [
        ("Bash", {"command": "gh issue list"}),
        ("Bash", {"command": "gh search issues --repo owner/repo"}),
        ("Bash", {"command": "gh api repos/owner/repo/issues"}),
        ("Bash", {"command": "curl https://github.com/owner/repo/issues/12"}),
        ("mcp__github__issue_read", {"owner": "owner", "repo": "repo"}),
        ("mcp__github__api", {"issue_number": 12}),
        ("browser_navigate", {"url": "https://github.com/owner/repo/issues"}),
    ]
    allowed = [
        ("Bash", {"command": "rg issue AGENTS.md"}),
        ("Bash", {"command": "gh pr view 12"}),
        ("mcp__github__pull_request_read", {"pull_number": 12}),
        ("browser_navigate", {"url": "https://github.com/owner/repo/pull/12"}),
        ("apply_patch", {"command": "Document the GitHub Issues policy"}),
    ]

    for tool_name, tool_input in blocked:
        assert should_block(tool_name, tool_input), (tool_name, tool_input)
    for tool_name, tool_input in allowed:
        assert not should_block(tool_name, tool_input), (tool_name, tool_input)
    print(f"issue guard: {len(blocked) + len(allowed)} checks passed")


def main() -> int:
    if sys.argv[1:] == ["--self-test"]:
        self_test()
        return 0

    try:
        event = json.load(sys.stdin)
    except (json.JSONDecodeError, OSError) as error:
        print(f"Issue guard could not parse hook input: {error}", file=sys.stderr)
        return 2

    if should_block(str(event.get("tool_name", "")), event.get("tool_input")):
        deny()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
