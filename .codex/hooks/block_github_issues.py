#!/usr/bin/env python3
"""Allow read-only Issue browsing; deny Issue operations."""

from __future__ import annotations

import json
import re
import sys
from typing import Any


DENIAL_REASON = (
    "Blocked by this repository's policy: only read-only browsing of GitHub Issues is allowed."
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
ISSUE_BROWSER_OPEN = re.compile(
    r"\s*(?:let\s+issueTab\s*=\s*)?await\s+"
    r"cua\.createBrowserTab\(\s*['\"]iab['\"]\s*,\s*"
    r"['\"]https://github\.com/daikusutora3/graph-editor/issues"
    r"(?:/\d+)?(?:\?[^'\"]*)?['\"]\s*,\s*"
    r"\{\s*visible:\s*(?:true|false)\s*\}\s*\);?\s*"
)
ISSUE_BROWSER_BIND = re.compile(
    r"\s*issueTab\s*=\s*await\s+cua\.getTab\(\s*"
    r"\{\s*url:\s*['\"]https://github\.com/daikusutora3/graph-editor/issues/\d+['\"]\s*\}"
    r"\s*,\s*\{\s*browser:\s*['\"]iab['\"]\s*\}\s*\);?\s*"
)
ISSUE_BROWSER_READ = re.compile(
    r"\s*await\s+(?:issueTab\.getAXState|cua\.getState)\(\s*\);?\s*"
)
GSC_BROWSER_BIND = re.compile(
    r"\s*let\s+gscTab\s*=\s*await\s+cua\.getTab\(\s*"
    r"\{\s*url:\s*['\"]https://search\.google\.com/search-console/index\?"
    r"resource_id=https%3A%2F%2Fgraph-editor\.daikusutora3\.workers\.dev%2F"
    r"&hl=ja['\"]\s*\}\s*,\s*\{\s*browser:\s*['\"]2['\"]\s*\}"
    r"\s*\);?\s*"
)
GSC_BROWSER_READ = re.compile(
    r"\s*await\s+gscTab\.(?:getAXState|getScreenshot|getAXStateAndScreenshot)"
    r"\(\s*\);?\s*"
)
GSC_PERFORMANCE_OPEN = re.compile(
    r"\s*let\s+perfTab\s*=\s*await\s+cua\.createBrowserTab\(\s*['\"]2['\"]\s*,\s*"
    r"['\"]https://search\.google\.com/search-console/performance/search-analytics\?"
    r"resource_id=https%3A%2F%2Fgraph-editor\.daikusutora3\.workers\.dev%2F"
    r"['\"]\s*\);?\s*"
)
GSC_PERFORMANCE_READ = re.compile(
    r"\s*await\s+perfTab\.(?:getAXState|getScreenshot|getAXStateAndScreenshot)"
    r"\(\s*\);?\s*"
)
GSC_SITEMAP_OPEN = re.compile(
    r"\s*let\s+sitemapTab\s*=\s*await\s+cua\.createBrowserTab\(\s*['\"]2['\"]\s*,\s*"
    r"['\"]https://search\.google\.com/search-console/sitemaps\?"
    r"resource_id=https%3A%2F%2Fgraph-editor\.daikusutora3\.workers\.dev%2F"
    r"['\"]\s*\);?\s*"
)
GSC_SITEMAP_READ = re.compile(
    r"\s*await\s+sitemapTab\.(?:getAXState|getScreenshot|getAXStateAndScreenshot)"
    r"\(\s*\);?\s*"
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


LOCAL_SAFARI_RUN = re.compile(r"\s*(?:/usr/bin/)?python3\s+tests/browser/safari-workflow\.py\s*")


def should_block(tool_name: str, tool_input: Any) -> bool:
    """Return True for Issue access outside permitted read-only browsing."""

    name = tool_name.casefold()
    payload = _compact_json(tool_input)

    # The web tool only reads public pages and cannot mutate an Issue.
    if name in ("web__run", "web.run"):
        return False

    # Restrict the entire computer-use surface while this policy applies.
    # Otherwise a later call could mutate an already-open Issue without
    # repeating its URL in the tool input.
    if name == "mcp__cua_repl__js":
        code = tool_input.get("code", "") if isinstance(tool_input, dict) else ""
        return not (
            ISSUE_BROWSER_OPEN.fullmatch(code)
            or ISSUE_BROWSER_BIND.fullmatch(code)
            or ISSUE_BROWSER_READ.fullmatch(code)
            or GSC_BROWSER_BIND.fullmatch(code)
            or GSC_BROWSER_READ.fullmatch(code)
            or GSC_PERFORMANCE_OPEN.fullmatch(code)
            or GSC_PERFORMANCE_READ.fullmatch(code)
            or GSC_SITEMAP_OPEN.fullmatch(code)
            or GSC_SITEMAP_READ.fullmatch(code)
        )

    # Dedicated GitHub Issue tools are unambiguous. This covers MCP tools such
    # as mcp__github__issue_read and future connector naming variants.
    if "github" in name and "issue" in name:
        return True

    if name in ("bash", "exec_command", "functions__exec_command"):
        command = _command_from(tool_input)
        # The reviewed Safari runner enforces the local origin and paths itself.
        # Do not allow command prefixes, arguments or chained shell actions to
        # turn this exception into arbitrary browser automation.
        if re.search(r"(?:^|\s)(?:/usr/bin/)?python3\s+tests/browser/safari-workflow\.py", command):
            return not bool(LOCAL_SAFARI_RUN.fullmatch(command))
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

    # Interactive browser/computer-use tools can also write to Issues.
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
        ("mcp__cua_repl__js", {"code": "await issueTab.click(1);"}),
        ("mcp__cua_repl__js", {"code": "await gscTab.click(1);"}),
        ("mcp__cua_repl__js", {"code": "await perfTab.click(1);"}),
        ("mcp__cua_repl__js", {"code": "await sitemapTab.click(1);"}),
        ("mcp__cua_repl__js", {"code": "await cua.createBrowserTab('iab', 'https://github.com/daikusutora3/graph-editor/issues', { visible: true }); await issueTab.click(1);"}),
    ]
    blocked.extend([
        ("Bash", {"command": "BASE_URL=https://github.com/owner/repo/issues python3 tests/browser/safari-workflow.py"}),
        ("exec_command", {"cmd": "python3 tests/browser/safari-workflow.py; open https://example.com"}),
        ("mcp__cua_repl__js", {"code": "let safari = await cua.getApp('Safari');"}),
        ("mcp__cua_repl__js", {"code": "await safariSettings.click(1);"}),
    ])
    allowed = [
        ("Bash", {"command": "rg issue AGENTS.md"}),
        ("Bash", {"command": "gh pr view 12"}),
        ("mcp__github__pull_request_read", {"pull_number": 12}),
        ("browser_navigate", {"url": "https://github.com/owner/repo/pull/12"}),
        ("apply_patch", {"command": "Document the GitHub Issues policy"}),
        ("web__run", {"open": [{"ref_id": "https://github.com/owner/repo/issues/12"}]}),
        ("mcp__cua_repl__js", {"code": "let issueTab = await cua.createBrowserTab('iab', 'https://github.com/daikusutora3/graph-editor/issues', { visible: true });"}),
        ("mcp__cua_repl__js", {"code": "issueTab = await cua.getTab({ url: 'https://github.com/daikusutora3/graph-editor/issues/41' }, { browser: 'iab' });"}),
        ("mcp__cua_repl__js", {"code": "await issueTab.getAXState();"}),
        ("mcp__cua_repl__js", {"code": "let gscTab = await cua.getTab({ url: 'https://search.google.com/search-console/index?resource_id=https%3A%2F%2Fgraph-editor.daikusutora3.workers.dev%2F&hl=ja' }, { browser: '2' });"}),
        ("mcp__cua_repl__js", {"code": "await gscTab.getAXState();"}),
        ("mcp__cua_repl__js", {"code": "let perfTab = await cua.createBrowserTab('2', 'https://search.google.com/search-console/performance/search-analytics?resource_id=https%3A%2F%2Fgraph-editor.daikusutora3.workers.dev%2F');"}),
        ("mcp__cua_repl__js", {"code": "await perfTab.getAXState();"}),
        ("mcp__cua_repl__js", {"code": "let sitemapTab = await cua.createBrowserTab('2', 'https://search.google.com/search-console/sitemaps?resource_id=https%3A%2F%2Fgraph-editor.daikusutora3.workers.dev%2F');"}),
        ("mcp__cua_repl__js", {"code": "await sitemapTab.getAXState();"}),
    ]

    allowed.extend([
        ("Bash", {"command": "/usr/bin/python3 tests/browser/safari-workflow.py"}),
        ("exec_command", {"cmd": "python3 tests/browser/safari-workflow.py"}),
    ])

    blocked.append(("mcp__cua_repl__js", {"code": "let safariSettings = await cua.getApp(\"Safari\");"}))

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
