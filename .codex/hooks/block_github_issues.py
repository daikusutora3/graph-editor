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


_LOCAL_GRAPH_ORIGIN = r"http://127\.0\.0\.1:332[34]"
_LOCAL_ARTICLE_SLUGS = r"edge-list|adjacency-matrix|tree-layout|tikz-export|bipartite-graph"
_LOCAL_ARTICLE_SECTION_IDS = {
    "edge-list": r"header|connections|import-check",
    "adjacency-matrix": r"rows-columns|symmetry|matrix-check",
    "tree-layout": r"tree-structure|tree-root|tree-spacing",
    "tikz-export": r"tikz-prepare|tikz-document|tikz-check",
    "bipartite-graph": r"bipartite-groups|bipartite-meaning|bipartite-layout",
}
_LOCAL_ARTICLE_COMMON_ANCHORS = (
    r"articles-top|article-content|article-example(?:-title)?|article-related(?:-title)?"
)
_LOCAL_ARTICLE_DETAIL_ROUTES = "|".join(
    rf"{slug}(?:#(?:{_LOCAL_ARTICLE_COMMON_ANCHORS}|article-(?:{sections})(?:-title)?))?"
    for slug, sections in _LOCAL_ARTICLE_SECTION_IDS.items()
)
_LOCAL_ARTICLE_PATH = (
    r"(?:/en|/zh-hans)?/articles"
    rf"(?:/(?:{_LOCAL_ARTICLE_DETAIL_ROUTES})|(?:#(?:articles-top|articles-content))?)"
)
_LOCAL_EXAMPLE_EDITOR_PATH = (
    rf"(?:/|/en|/zh-hans)\?example=(?:{_LOCAL_ARTICLE_SLUGS})"
)
_LOCAL_GRAPH_LEGACY_PATH = (
    r"(?:/|/en|/zh-hans|/guide|/en/guide|/zh-hans/guide)?"
    r"(?:#(?:guide-[a-z0-9-]+|edge-list|adjacency-matrix|weighted-tree))?"
)
_LOCAL_GRAPH_URL = (
    rf"{_LOCAL_GRAPH_ORIGIN}"
    rf"(?:{_LOCAL_GRAPH_LEGACY_PATH}|{_LOCAL_ARTICLE_PATH}|{_LOCAL_EXAMPLE_EDITOR_PATH})"
)
_LOCAL_GRAPH_BIND_URL = (
    rf"{_LOCAL_GRAPH_ORIGIN}"
    rf"(?:(?:/|/en|/zh-hans)|{_LOCAL_ARTICLE_PATH}|{_LOCAL_EXAMPLE_EDITOR_PATH})"
)

LOCAL_GRAPH_OPEN = re.compile(
    r"\s*let\s+localGraphTab\s*=\s*await\s+cua\.createBrowserTab\(\s*['\"]iab['\"]\s*,\s*"
    rf"['\"]{_LOCAL_GRAPH_URL}['\"]\s*,\s*"
    r"\{\s*visible:\s*true\s*\}\s*\);?\s*"
)
LOCAL_GRAPH_NAVIGATE = re.compile(
    rf"\s*await\s+localGraphTab\.goto\(\s*['\"]{_LOCAL_GRAPH_URL}['\"]\s*\);?\s*"
)
LOCAL_GRAPH_BIND = re.compile(
    r"\s*(?:let\s+)?localGraphTab\s*=\s*await\s+cua\.getTab\(\s*"
    rf"\{{\s*url:\s*['\"]{_LOCAL_GRAPH_BIND_URL}['\"]\s*\}}"
    r"\s*,\s*\{\s*browser:\s*['\"]iab['\"]\s*\}\s*\);?\s*"
)
LOCAL_GRAPH_READ = re.compile(
    r"\s*await\s+localGraphTab\.(?:getAXState|getScreenshot|getAXStateAndScreenshot)\(\s*\);?\s*"
    r"|\s*await\s+localGraphTab\.(?:getAXState|getAXStateAndScreenshot)\(\s*"
    r"\{\s*disableDiffing:\s*true\s*\}\s*\);?\s*"
)

# Only literal UI arguments; no arbitrary expressions or scripts.
_LOCAL_STRING = r"(?:\"(?:[^\"\\]|\\.)*\"|'(?:[^'\\]|\\.)*')"
_LOCAL_LITERAL = rf"(?:{_LOCAL_STRING}|null|true|false|\d+|\[\s*\d+\s*,\s*\d+\s*\])"
_LOCAL_OPTIONS = rf"\{{\s*(?:clickCount|mouseButton|key):\s*{_LOCAL_LITERAL}\s*\}}"
LOCAL_GRAPH_ACTION = re.compile(
    rf"\s*await\s+localGraphTab\.(?:click|setValue|typeText|paste|pressKey|scroll|selectText)"
    rf"\(\s*{_LOCAL_LITERAL}(?:\s*,\s*(?:{_LOCAL_LITERAL}|{_LOCAL_OPTIONS}))*\s*\);?"
    r"\s*(?:await\s+localGraphTab\.getAXState\(\);?\s*)?"
)
LOCAL_GRAPH_RELOAD = re.compile(r"\s*await\s+localGraphTab\.(?:reload|markDeliverable)\(\);?\s*")
LOCAL_GRAPH_SAVE_SCREENSHOT = re.compile(
    r"\s*await \(await import\('node:fs/promises'\)\)\.writeFile\("
    r"'/tmp/graph-editor-text-weights.png', await localGraphTab\.getScreenshot\(\{ emit: false \}\)\);\s*"
)


# Read only the documented viewport capability for the authorized local IAB
# review. These calls do not inspect or operate another tab or application.
LOCAL_GRAPH_REVIEW_DOCS = re.compile(
    r"\s*(?:await cua\.rewriteDocumentation\(\);|let localGraphBrowser = await cua\.getBrowser\(\{ id: 'iab' \}\);|"
    r"nodeRepl\.write\(await \(await localGraphBrowser\.capabilities\.get\('viewport'\)\)\.documentation\(\)\);|"
    r"nodeRepl\.write\(await agent\.documentation\.get\('(?:screenshots|local-web-development)'\)\);)\s*"
)
LOCAL_GRAPH_REVIEW_SCREENSHOT = re.compile(
    r"\s*await \(await import\('node:fs/promises'\)\)\.writeFile\("
    r"'/tmp/graph-editor-ui-review/(?:before|after)-[a-z0-9-]+\.(?:png|jpg)', "
    r"await localGraphTab\.getScreenshot\(\{ emit: false \}\)\);\s*"
)


# Verify only the known guide edge-list example without revealing clipboard data.
LOCAL_GRAPH_GUIDE_COPY_CHECK = re.compile(
    r'\s*nodeRepl\.write\(\(await localGraphTab\.clipboard\.readText\(\)\) === '
    r'"4 4\\n1 2\\n2 3\\n2 4\\n3 4"\);\s*'
)


LOCAL_GRAPH_REVIEW_VIEWPORT = re.compile(
    r"\s*await \(await localGraphBrowser\.capabilities\.get\('viewport'\)\)\."
    r"(?:reset\(\)|set\(\{ width: (?:320|360|375|390|480|600|640|767|768|960|1280), "
    r"height: (?:390|720|900) \}\));\s*"
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
            LOCAL_GRAPH_OPEN.fullmatch(code)
            or LOCAL_GRAPH_BIND.fullmatch(code)
            or LOCAL_GRAPH_NAVIGATE.fullmatch(code)
            or LOCAL_GRAPH_READ.fullmatch(code)
            or LOCAL_GRAPH_ACTION.fullmatch(code)
            or LOCAL_GRAPH_RELOAD.fullmatch(code)
            or LOCAL_GRAPH_SAVE_SCREENSHOT.fullmatch(code)
            or LOCAL_GRAPH_REVIEW_DOCS.fullmatch(code)
            or LOCAL_GRAPH_REVIEW_SCREENSHOT.fullmatch(code)
            or LOCAL_GRAPH_REVIEW_VIEWPORT.fullmatch(code)
            or LOCAL_GRAPH_GUIDE_COPY_CHECK.fullmatch(code)
            or ISSUE_BROWSER_OPEN.fullmatch(code)
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

    allowed.extend([
        ("mcp__cua_repl__js", {"code": "let localGraphTab = await cua.createBrowserTab('iab', 'http://127.0.0.1:3324/en', { visible: true });"}),
        ("mcp__cua_repl__js", {"code": "await localGraphTab.getAXState();"}),
        ("mcp__cua_repl__js", {"code": "await localGraphTab.getAXState({ disableDiffing: true });"}),
        ("mcp__cua_repl__js", {"code": "await localGraphTab.getAXStateAndScreenshot({ disableDiffing: true });"}),
    ])
    blocked.extend([
        ("mcp__cua_repl__js", {"code": "let localGraphTab = await cua.createBrowserTab('iab', 'https://example.com', { visible: true });"}),
        ("mcp__cua_repl__js", {"code": "await localGraphTab.evaluate('location.href=123');"}),
        ("mcp__cua_repl__js", {"code": "await localGraphTab.getAXState(arbitraryOptions);"}),
    ])
    allowed.extend([
        ("mcp__cua_repl__js", {"code": "await localGraphTab.click(16, { clickCount: 2 }); await localGraphTab.getAXState();"}),
        ("mcp__cua_repl__js", {"code": 'await localGraphTab.setValue(86, "容量 ∞"); await localGraphTab.getAXState();'}),
        ("mcp__cua_repl__js", {"code": "await localGraphTab.reload();"}),
        ("mcp__cua_repl__js", {"code": "await (await import('node:fs/promises')).writeFile('/tmp/graph-editor-text-weights.png', await localGraphTab.getScreenshot({ emit: false }));"}),
    ])
    blocked.extend([
        ("mcp__cua_repl__js", {"code": "await localGraphTab.click(cua.getApp('Safari'));"}),
        ("mcp__cua_repl__js", {"code": "await localGraphTab.goto('https://github.com/daikusutora3/graph-editor/issues/1');"}),
        ("mcp__cua_repl__js", {"code": "await localGraphTab.reload(); await issueTab.click(1);"}),
    ])
    allowed.extend([
        ("mcp__cua_repl__js", {"code": "let localGraphBrowser = await cua.getBrowser({ id: 'iab' });"}),
        ("mcp__cua_repl__js", {"code": "nodeRepl.write(await (await localGraphBrowser.capabilities.get('viewport')).documentation());"}),
        ("mcp__cua_repl__js", {"code": "nodeRepl.write(await agent.documentation.get('screenshots'));"}),
        ("mcp__cua_repl__js", {"code": "await (await import('node:fs/promises')).writeFile('/tmp/graph-editor-ui-review/before-320-png.png', await localGraphTab.getScreenshot({ emit: false }));"}),
    ])
    blocked.extend([
        ("mcp__cua_repl__js", {"code": "let localGraphBrowser = await cua.getBrowser({ id: 'chrome' });"}),
        ("mcp__cua_repl__js", {"code": "nodeRepl.write(await (await localGraphBrowser.capabilities.get('history')).documentation());"}),
        ("mcp__cua_repl__js", {"code": "await (await import('node:fs/promises')).writeFile('/tmp/other.png', await localGraphTab.getScreenshot({ emit: false }));"}),
        ("mcp__cua_repl__js", {"code": "await localGraphTab.getScreenshot(); await issueTab.click(1);"}),
    ])
    allowed.extend([
        ("mcp__cua_repl__js", {"code": "await (await localGraphBrowser.capabilities.get('viewport')).set({ width: 320, height: 900 });"}),
        ("mcp__cua_repl__js", {"code": "await (await localGraphBrowser.capabilities.get('viewport')).reset();"}),
        ("mcp__cua_repl__js", {"code": "await (await import('node:fs/promises')).writeFile('/tmp/graph-editor-ui-review/after-320-png.jpg', await localGraphTab.getScreenshot({ emit: false }));"}),
    ])
    blocked.extend([
        ("mcp__cua_repl__js", {"code": "await (await localGraphBrowser.capabilities.get('viewport')).set({ width: arbitraryWidth, height: 900 });"}),
        ("mcp__cua_repl__js", {"code": "await (await localGraphBrowser.capabilities.get('viewport')).reset(); await issueTab.click(1);"}),
        ("mcp__cua_repl__js", {"code": "await (await localGraphBrowser.capabilities.get('viewport')).set({ width: 320, height: 900, url: 'https://example.com' });"}),
    ])
    allowed.append(("mcp__cua_repl__js", {"code": r'nodeRepl.write((await localGraphTab.clipboard.readText()) === "4 4\n1 2\n2 3\n2 4\n3 4");'}))
    blocked.extend([
        ("mcp__cua_repl__js", {"code": "nodeRepl.write(await localGraphTab.clipboard.readText());"}),
        ("mcp__cua_repl__js", {"code": "await localGraphTab.clipboard.writeText('arbitrary text');"}),
        ("mcp__cua_repl__js", {"code": "nodeRepl.write((await issueTab.clipboard.readText()) === 'text');"}),
    ])
    # Guide verification stays on the approved origins and exact route paths.
    for route in ("/guide", "/en/guide", "/zh-hans/guide"):
        for port in (3323, 3324):
            url = f"http://127.0.0.1:{port}{route}"
            allowed.extend([
                ("mcp__cua_repl__js", {"code": f"let localGraphTab = await cua.createBrowserTab('iab', '{url}', {{ visible: true }});"}),
                ("mcp__cua_repl__js", {"code": f"await localGraphTab.goto('{url}#guide-examples');"}),
            ])
    for url in (
        "https://127.0.0.1:3324/en/guide",
        "http://127.0.0.1:3325/en/guide",
        "http://127.0.0.1:3324/en/guide/other",
        "http://127.0.0.1:3324/en/guide?next=https://example.com",
        "http://127.0.0.1:3324/en/guide#arbitrary",
        "http://127.0.0.1:3324/settings",
        "https://example.com/en/guide",
    ):
        blocked.append(("mcp__cua_repl__js", {"code": f"await localGraphTab.goto('{url}');"}))
    blocked.extend([
        ("mcp__cua_repl__js", {"code": "await localGraphTab.goto(arbitraryUrl);"}),
        ("mcp__cua_repl__js", {"code": "await localGraphTab.goto('http://127.0.0.1:3324/en/guide'); await issueTab.click(1);"}),
    ])
    for route in ("/", "/en", "/zh-hans"):
        for port in (3323, 3324):
            allowed.append(("mcp__cua_repl__js", {"code": f"localGraphTab = await cua.getTab({{ url: 'http://127.0.0.1:{port}{route}' }}, {{ browser: 'iab' }});"}))
            allowed.append(("mcp__cua_repl__js", {"code": f"let localGraphTab = await cua.getTab({{ url: 'http://127.0.0.1:{port}{route}' }}, {{ browser: 'iab' }});"}))
    blocked.extend([
        ("mcp__cua_repl__js", {"code": "let localGraphTab = await cua.getTab({ url: 'https://example.com/' }, { browser: 'iab' });"}),
        ("mcp__cua_repl__js", {"code": "localGraphTab = await cua.getTab({ url: 'https://example.com/' }, { browser: 'iab' });"}),
        ("mcp__cua_repl__js", {"code": "localGraphTab = await cua.getTab({ url: 'http://127.0.0.1:3324/guide' }, { browser: 'iab' });"}),
        ("mcp__cua_repl__js", {"code": "localGraphTab = await cua.getTab({ url: 'http://127.0.0.1:3324/' }, { browser: 'chrome' });"}),
        ("mcp__cua_repl__js", {"code": "localGraphTab = await cua.getTab(arbitraryTab);"}),
        ("mcp__cua_repl__js", {"code": "localGraphTab = await cua.getTab({ url: 'http://127.0.0.1:3324/' }, { browser: 'iab' }); await issueTab.click(1);"}),
    ])

    # User-authorized article pages and isolated example editors remain exact:
    # no arbitrary article slug, fragment, query parameter or extra navigation.
    def article_browser_calls(url: str) -> list[tuple[str, dict[str, str]]]:
        return [
            ("mcp__cua_repl__js", {"code": f"let localGraphTab = await cua.createBrowserTab('iab', '{url}', {{ visible: true }});"}),
            ("mcp__cua_repl__js", {"code": f"await localGraphTab.goto('{url}');"}),
            ("mcp__cua_repl__js", {"code": f"localGraphTab = await cua.getTab({{ url: '{url}' }}, {{ browser: 'iab' }});"}),
        ]

    for port in (3323, 3324):
        for prefix in ("", "/en", "/zh-hans"):
            origin = f"http://127.0.0.1:{port}"
            index_url = f"{origin}{prefix}/articles"
            editor_path = prefix or "/"
            for suffix in ("", "#articles-top", "#articles-content"):
                allowed.extend(article_browser_calls(f"{index_url}{suffix}"))
            for slug, section_ids in _LOCAL_ARTICLE_SECTION_IDS.items():
                detail_url = f"{index_url}/{slug}"
                allowed.extend(article_browser_calls(detail_url))
                allowed.extend(article_browser_calls(f"{origin}{editor_path}?example={slug}"))
                for anchor in ("articles-top", "article-content", "article-example", "article-example-title", "article-related", "article-related-title"):
                    allowed.extend(article_browser_calls(f"{detail_url}#{anchor}"))
                for section_id in section_ids.split("|"):
                    allowed.extend(article_browser_calls(f"{detail_url}#article-{section_id}"))
                    allowed.extend(article_browser_calls(f"{detail_url}#article-{section_id}-title"))
            for suffix in ("/unknown", "/edge-list/extra", "?example=edge-list", "#article-example", "#arbitrary"):
                blocked.extend(article_browser_calls(f"{index_url}{suffix}"))
            for suffix in ("?example=unknown", "?example=edge-list&next=external", "?example=edge-list&example=tree-layout", "?example=edge-list#arbitrary", "?other=1"):
                blocked.extend(article_browser_calls(f"{origin}{editor_path}{suffix}"))

    for url in (
        "https://127.0.0.1:3324/articles/edge-list",
        "http://127.0.0.1:3325/articles/edge-list",
        "http://localhost:3324/articles/edge-list",
        "https://example.com/articles/edge-list",
        "http://127.0.0.1:3324/articles/edge-list?next=external",
        "http://127.0.0.1:3324/articles/edge-list#arbitrary",
        "http://127.0.0.1:3324/articles/edge-list#article-tikz-document",
        "http://127.0.0.1:3324/articles/edge-list#guide-import",
        "http://127.0.0.1:3324/articles/%65dge-list",
        "http://127.0.0.1:3324/en/?example=edge-list",
    ):
        blocked.extend(article_browser_calls(url))
    blocked.append(("mcp__cua_repl__js", {"code": "await localGraphTab.goto('http://127.0.0.1:3324/articles/edge-list'); await issueTab.click(1);"}))
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
