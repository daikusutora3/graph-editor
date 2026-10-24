#!/usr/bin/env python3
"""Installed Safari checks restricted to this application's approved local preview."""
import base64
import json
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ORIGIN = "http://127.0.0.1:3323"
DRIVER = "http://127.0.0.1:4447"
OUTPUT = Path("/tmp/graph-editor-safari-review")
ELEMENT = "element-6066-11e4-a52e-4f735466cecf"


class DriverTimeoutError(RuntimeError):
    """The browser may still be processing the timed-out native command."""


def approved(url):
    p = urllib.parse.urlsplit(url)
    return (p.scheme == "http" and p.netloc == "127.0.0.1:3323"
            and p.path in ("/", "/en", "/zh-hans") and not p.query and not p.fragment)


def policy_checks():
    for path in ("/", "/en", "/zh-hans"):
        assert approved(ORIGIN + path)
    for url in ("https://github.com/daikusutora3/graph-editor/issues/1",
                "https://example.com", ORIGIN + "/guide", ORIGIN + "/en/guide",
                "http://localhost:3323/", "http://127.0.0.1:9999/",
                "http://127.0.0.1:3323@github.com/", ORIGIN + "/?redirect=https://github.com",
                ORIGIN + "/#external", ORIGIN + "/%2e%2e/"):
        assert not approved(url), url
    print("Safari URL policy: 13 checks passed", flush=True)


class Session:
    def __init__(self):
        result = self.request("POST", "/session", {"capabilities": {"alwaysMatch": {"browserName": "safari"}}})
        self.id = result["sessionId"]
        self.capabilities = result["capabilities"]

    def restart(self):
        self.close()
        self.__init__()
        self.navigate("/")
        self.wait("return document.readyState==='complete'")

    def focus_window(self):
        handle = self.command("GET", "/window")
        self.command("POST", "/window", {"handle": handle})

    def verify_storage(self):
        """Reject a broken native storage backend before testing autosave."""
        key = "graph-editor-safari-storage-probe"
        value = str(time.time_ns())
        self.js("""const key=arguments[0],value=arguments[1];
            window.__safariStorageProbe={key,value,initial:null,later:null,done:false};
            localStorage.setItem(key,value);
            window.__safariStorageProbe.initial=localStorage.getItem(key);
            window.setTimeout(()=>{window.__safariStorageProbe.later=localStorage.getItem(key);window.__safariStorageProbe.done=true;},250);
        """, key, value)
        self.wait("return window.__safariStorageProbe?.done===true")
        probe = self.js("return {...window.__safariStorageProbe,current:localStorage.getItem(arguments[0]),url:location.href};", key)
        self.js("localStorage.removeItem(arguments[0]);", key)
        probe["status"] = "passed" if probe["initial"] == value and probe["later"] == value and probe["current"] == value else "failed"
        (OUTPUT / "native-storage-preflight.json").write_text(json.dumps(probe, indent=2))
        assert probe["status"] == "passed", "Safari's native localStorage backend discarded a write before application testing; see native-storage-preflight.json"

    @staticmethod
    def request(method, path, data=None):
        payload = None if data is None else json.dumps(data).encode()
        request = urllib.request.Request(DRIVER + path, data=payload, method=method,
                                         headers={"Content-Type": "application/json"})
        for attempt in range(2):
            try:
                with urllib.request.urlopen(request, timeout=40) as response:
                    result = json.load(response)
                break
            except urllib.error.HTTPError as error:
                raise RuntimeError(error.read().decode()) from error
            except TimeoutError as error:
                # A read can be repeated without replaying an editor command.
                # Never repeat POST/DELETE: its effect may already be committed.
                if method != "GET" or attempt == 1:
                    raise DriverTimeoutError(f"Safari driver timed out: {method} {path}") from error
                print(f"Safari driver: retrying timed-out read {method} {path}", flush=True)
        value = result.get("value")
        if isinstance(value, dict) and "error" in value:
            raise RuntimeError(json.dumps(value))
        return value

    def command(self, method, path, data=None, check=True):
        if check:
            url = self.request("GET", f"/session/{self.id}/url")
            assert approved(url), f"Blocked browser operation outside local preview: {url}"
        return self.request(method, f"/session/{self.id}" + path, data)

    def navigate(self, path):
        url = ORIGIN + path
        assert approved(url), f"Navigation denied: {url}"
        token = str(time.time_ns())
        current = self.request("GET", f"/session/{self.id}/url")
        if approved(current):
            self.js("window.__safariPreviousDocument=arguments[0];", token)
        self.command("POST", "/url", {"url": url}, check=False)
        condition = "return location.href===" + json.dumps(url) + "&&document.readyState==='complete'&&window.__safariPreviousDocument!==" + json.dumps(token)
        if path != "/":
            locale = {"/en": "en", "/zh-hans": "zh-Hans"}[path]
            condition += "&&document.documentElement.dataset.locale===" + json.dumps(locale)
        self.wait(condition)

    def refresh(self):
        token = str(time.time_ns())
        url = self.js("window.__safariPreviousDocument=arguments[0];return location.href;", token)
        self.command("POST", "/refresh", {})
        self.wait("return location.href===" + json.dumps(url) + "&&document.readyState==='complete'&&window.__safariPreviousDocument!==" + json.dumps(token))

    def js(self, script, *args):
        return self.command("POST", "/execute/sync", {"script": script, "args": list(args)})

    def wait(self, script, timeout=15):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            result = self.js(script)
            if result:
                return result
            time.sleep(0.1)
        raise AssertionError(f"Timed out: {script}")

    def element(self, selector):
        self.wait("return !!document.querySelector(arguments[0])".replace("arguments[0]", json.dumps(selector)))
        return self.command("POST", "/element", {"using": "css selector", "value": selector})[ELEMENT]

    def button(self, label):
        element = self.wait("return [...document.querySelectorAll('button')].find(e=>"
            "(e.getAttribute('aria-label')===" + json.dumps(label) + "||e.textContent.trim()===" + json.dumps(label) + ")"
            "&&!e.disabled&&e.getClientRects().length&&!e.closest('[inert],[data-panel-state=closing]')"
            "&&getComputedStyle(e).visibility!=='hidden');")
        return element[ELEMENT]

    def click(self, element):
        self.command("POST", f"/element/{element}/click", {})

    def activate(self, element):
        """Activate one real button with native Space; never repeat a command."""
        assert self.js("const e=arguments[0];return e.tagName==='BUTTON'&&!e.disabled&&!e.closest('[inert]');", {ELEMENT: element})
        self.js("arguments[0].focus();", {ELEMENT: element})
        self.command("POST", "/actions", {"actions": [{"type": "key", "id": "activation-keyboard", "actions": [
            {"type": "keyDown", "value": " "}, {"type": "keyUp", "value": " "}]}]})

    def close_panel(self, panel):
        self.activate(self.element(f"[data-editor-panel={panel}] [data-panel-close=true]"))
        self.wait("return !document.querySelector(arguments[0])".replace(
            "arguments[0]", json.dumps(f"[data-editor-panel={panel}]")))

    def open_panel(self, label, panel):
        # SafariDriver can swallow mouse clicks in an unfocused automation
        # window. Focus the real control, then activate it with native Space.
        # Retry only an opening action after checking that it is still closed.
        script = "return !!document.querySelector(arguments[0])".replace(
            "arguments[0]", json.dumps(f"[data-editor-panel={panel}]"))
        for attempt in range(2):
            if self.js(script):
                return
            self.activate(self.button(label))
            try:
                self.wait(script, timeout=3)
                return
            except AssertionError:
                if attempt == 1:
                    raise

    def screenshot(self, name):
        time.sleep(0.3)
        (OUTPUT / f"{name}.png").write_bytes(base64.b64decode(self.command("GET", "/screenshot")))

    def close(self):
        self.command("DELETE", "", check=False)


def run_design_guidelines_review(session):
    """Rendered expert review of the design changes in each locale and theme."""
    messages = {
        "ja": {"path": "/", "load": "グラフを読み込む", "apply": "グラフに反映", "export": "書き出し", "image": "PNG 画像",
               "input": "グラフのデータ", "format": "形式", "example": "入力例", "useExample": "この例を入力",
               "fixedCanvas": "倍率＋枠指定", "modes": ["選択", "頂点", "辺"],
               "addNode": "中央付近に頂点を追加", "undo": "戻す", "redo": "進む", "transparent": "透過",
               "guide": "使い方ガイド", "articles": "記事", "shortcuts": "キーボードショートカット",
               "samples": "サンプルを使う", "clearSearch": "検索をクリア", "clearFilters": "絞り込みをクリア"},
        "en": {"path": "/en", "load": "Load a graph", "apply": "Apply to graph", "export": "Export", "image": "PNG image",
               "input": "Graph data", "format": "Format", "example": "Input example", "useExample": "Use this example",
               "fixedCanvas": "Fixed canvas", "modes": ["Select", "Node", "Edge"],
               "addNode": "Add node near center", "undo": "Undo", "redo": "Redo", "transparent": "Clear",
               "guide": "User guide", "articles": "Articles", "shortcuts": "Keyboard shortcuts",
               "samples": "Use a sample", "clearSearch": "Clear search", "clearFilters": "Clear filters"},
        "zh-hans": {"path": "/zh-hans", "load": "加载图", "apply": "应用到图", "export": "导出", "image": "PNG 图像",
                    "input": "图数据", "format": "格式", "example": "输入示例", "useExample": "填入此示例",
                    "fixedCanvas": "指定画布", "modes": ["选择", "顶点", "边"],
                    "addNode": "在中央附近添加顶点", "undo": "撤销", "redo": "重做", "transparent": "透明",
                    "guide": "使用指南", "articles": "文章", "shortcuts": "键盘快捷键",
                    "samples": "使用示例", "clearSearch": "清除搜索", "clearFilters": "清除筛选"},
    }
    results = []
    current_case = None
    report = OUTPUT / "design-guidelines-results.json"

    def save(status, error=None):
        report.write_text(json.dumps({
            "status": status, "review": "Expert review in isolated installed Safari",
            "results": results, "currentCase": current_case, "error": error,
            "focusAppearanceStatus": "passed" if results and all(r["outputKeyboardFocus"]["appearanceChecked"] for r in results) else "incomplete-or-window-inactive",
            "limits": ["Window widths are requested sizes; each result records the actual viewport",
                       "DOM associations and native keyboard behavior checked; no screen-reader or first-use participant test",
                       "Focus appearance is asserted only while Safari reports its test document focused; inactive cases are recorded",
                       "No file download, clipboard permission or system accessibility setting changes"],
        }, indent=2, ensure_ascii=False))

    def key(value):
        session.command("POST", "/actions", {"actions": [{"type": "key", "id": "design-keyboard", "actions": [
            {"type": "keyDown", "value": value}, {"type": "keyUp", "value": value}]}]})

    def replace_input(text):
        element = session.element("[data-editor-panel=starter] textarea")
        clear_input(element)
        if text:
            session.command("POST", f"/element/{element}/value", {"text": text})
        session.wait("return document.querySelector('[data-editor-panel=starter] textarea')?.value===" + json.dumps(text))

    def clear_input(element):
        # SafariDriver's clear endpoint can change the DOM value without the
        # input event a controlled React field needs. Exercise actual editing.
        session.js("arguments[0].focus();", {ELEMENT: element})
        session.command("POST", "/actions", {"actions": [{"type": "key", "id": "design-text-keyboard", "actions": [
            {"type": "keyDown", "value": "\ue03d"}, {"type": "keyDown", "value": "a"},
            {"type": "keyUp", "value": "a"}, {"type": "keyUp", "value": "\ue03d"},
            {"type": "keyDown", "value": "\ue003"}, {"type": "keyUp", "value": "\ue003"}]}]})

    def close_panel(panel):
        close = session.element(f"[data-editor-panel={panel}] [data-panel-close=true]")
        session.js("arguments[0].focus();", {ELEMENT: close})
        key("\ue007")
        session.wait("return !document.querySelector('[data-editor-panel=" + panel + "]')")

    def panel_geometry(panel):
        session.wait("const p=document.querySelector(arguments[0]);return p&&p.getAnimations().every(a=>a.playState!=='running');".replace(
            "arguments[0]", json.dumps(f"[data-editor-panel={panel}]")))
        geometry = session.js("""const p=document.querySelector(arguments[0]); const r=p.getBoundingClientRect();
            return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,
                viewportWidth:innerWidth,viewportHeight:innerHeight,documentWidth:document.documentElement.scrollWidth};""",
            f"[data-editor-panel={panel}]")
        assert geometry["left"] >= -1 and geometry["right"] <= geometry["viewportWidth"] + 1, geometry
        assert geometry["top"] >= -1 and geometry["bottom"] <= geometry["viewportHeight"] + 1, geometry
        assert geometry["documentWidth"] <= geometry["viewportWidth"] + 1, geometry
        return geometry

    save("running")
    try:
        for locale, m in messages.items():
            for width in (600, 1440):
                for theme in ("light", "dark"):
                    current_case = {"locale": locale, "theme": theme, "requestedWindowWidth": width}
                    save("running")
                    session.command("POST", "/window/rect", {"width": width, "height": 1000}, check=False)
                    session.navigate(m["path"])
                    # This session is isolated from the user's normal Safari data.
                    session.js("localStorage.clear();localStorage.setItem('graph-editor-theme',arguments[0]);", theme)
                    session.refresh()
                    session.wait("return !!document.querySelector('[data-canvas-ready=true]')")
                    session.wait("return document.documentElement.dataset.theme===" + json.dumps(theme))
                    dimensions = session.js("return {width:innerWidth,height:innerHeight,devicePixelRatio,layout:document.querySelector('[data-layout]')?.dataset.layout}")
                    session.focus_window()
                    prefix = f"design-{locale}-{theme}-{width}"
                    screenshots = []

                    def capture(stage):
                        name = f"{prefix}-{stage}"
                        session.screenshot(name)
                        screenshots.append(name + ".png")

                    mobile_mode_labels = None
                    if dimensions["layout"] == "mobile":
                        mobile_mode_labels = session.js("""return arguments[0].map(label=>{
                            const e=[...document.querySelectorAll('[role=toolbar] button[aria-pressed]')]
                                .find(button=>button.getAttribute('aria-label')===label);
                            const caption=e?.querySelector('span');const r=e?.getBoundingClientRect();
                            const c=caption?.getBoundingClientRect();
                            return {label,text:caption?.textContent.trim(),visible:!!c?.width&&!!c?.height,
                                height:r?.height,captionWithinButton:!!r&&!!c&&c.top>=r.top&&c.bottom<=r.bottom};
                        });""", m["modes"])
                        assert all(item["text"] == item["label"] and item["visible"] and item["height"] >= 44
                                   and item["captionWithinButton"] for item in mobile_mode_labels), mobile_mode_labels
                        capture("mobile-mode-labels")

                    session.activate(session.element('[data-editor-panel-trigger="app"]'))
                    session.wait("return !!document.querySelector('[data-editor-panel=app] [role=menu]')")
                    help_menu = session.js("""return [...document.querySelectorAll('[data-editor-panel=app] [role=menuitem]')]
                        .map(e=>({text:e.textContent.trim(),href:e.getAttribute('href'),tag:e.tagName}));""")
                    assert len(help_menu) >= 6, help_menu
                    assert all(help_menu[index]["text"].startswith(m[label])
                               for index, label in enumerate(("guide", "articles", "shortcuts"))), help_menu
                    assert help_menu[0]["href"] == {"ja": "/guide", "en": "/en/guide", "zh-hans": "/zh-hans/guide"}[locale], help_menu
                    assert help_menu[3]["href"] == "https://github.com/daikusutora3/graph-editor", help_menu
                    capture("help-menu")
                    close_panel("app")

                    session.open_panel(m["load"], "starter")
                    session.activate(session.button(m["samples"]))
                    session.wait("return !!document.querySelector('input[name=sample-search]')")
                    sample_controls = session.js("""return ['input[name=sample-search]','[data-editor-panel=starter] select'].map(selector=>{
                        const e=document.querySelector(selector);return {labels:[...e.labels].map(label=>({
                            text:label.textContent.trim(),visible:!!label.getClientRects().length})),placeholder:e.getAttribute('placeholder')};});""")
                    assert all(any(label["text"] and label["visible"] for label in control["labels"])
                               for control in sample_controls), sample_controls
                    assert sample_controls[0]["placeholder"] is None, sample_controls
                    search = session.element('input[name=sample-search]')
                    session.command("POST", f"/element/{search}/value", {"text": "no-such-sample-ui-review"})
                    session.wait("return !!document.querySelector('input[name=sample-search]')?.value")
                    session.activate(session.button(m["clearSearch"]))
                    session.wait("const e=document.querySelector('input[name=sample-search]');return e.value===''&&document.activeElement===e")
                    session.command("POST", f"/element/{search}/value", {"text": "no-such-sample-ui-review"})
                    session.activate(session.button(m["clearFilters"]))
                    session.wait("const e=document.querySelector('input[name=sample-search]');return e.value===''&&document.activeElement===e&&document.querySelector('[data-editor-panel=starter] select').value==='all'")
                    capture("sample-search-focus")
                    close_panel("starter")

                    session.activate(session.button(m["modes"][1]))
                    add_node = session.button(m["addNode"])
                    session.js("arguments[0].focus();", {ELEMENT: add_node})
                    key("\ue007")
                    session.wait("return JSON.parse(localStorage.getItem('graph-editor-graph')||'null')?.nodes.length===1")
                    assert session.js("return document.activeElement===arguments[0]", {ELEMENT: add_node}), "Enter retains focus for repeated node creation"
                    key(" ")
                    session.wait("return JSON.parse(localStorage.getItem('graph-editor-graph')||'null')?.nodes.length===2")
                    assert session.js("return document.activeElement===arguments[0]", {ELEMENT: add_node}), "Space retains focus for repeated node creation"
                    created_nodes = session.js("return JSON.parse(localStorage.getItem('graph-editor-graph')).nodes")
                    node_action = session.js("""const e=arguments[0];return {
                        label:e.textContent.trim(),description:document.getElementById(e.getAttribute('aria-describedby'))?.textContent.trim(),
                        status:e.closest('[data-editor-chrome-control]').querySelector('[role=status]')?.textContent.trim()};""", {ELEMENT: add_node})
                    assert node_action["label"] == m["addNode"] and node_action["description"] and node_action["status"], node_action
                    assert len({node["id"] for node in created_nodes}) == 2, created_nodes
                    session.activate(session.button(m["undo"]))
                    session.wait("return JSON.parse(localStorage.getItem('graph-editor-graph')||'null')?.nodes.length===1")
                    session.activate(session.button(m["redo"]))
                    session.wait("return JSON.parse(localStorage.getItem('graph-editor-graph')||'null')?.nodes.length===2")
                    assert session.js("return JSON.parse(localStorage.getItem('graph-editor-graph')).nodes") == created_nodes, "Redo restores the same nodes and coordinates"
                    node_action["createdCount"] = 2
                    node_action["undoRedo"] = "passed"
                    capture("keyboard-nodes")

                    session.activate(session.button(m["modes"][2]))
                    session.wait("return document.querySelectorAll('button[data-edge-node-hitbox=true]').length===2")
                    edge_hitboxes = session.js("return [...document.querySelectorAll('button[data-edge-node-hitbox=true]')];")
                    source_hitbox = edge_hitboxes[0][ELEMENT]
                    target_hitbox = edge_hitboxes[1][ELEMENT]
                    source_label = session.js("return arguments[0].getAttribute('aria-label')", {ELEMENT: source_hitbox})
                    session.js("arguments[0].focus();", {ELEMENT: source_hitbox})
                    key("\ue007")
                    session.wait("return document.querySelector('button[data-edge-node-hitbox=true]')?.getAttribute('aria-label')!==" + json.dumps(source_label) + "&&!document.querySelector('.ge-inline-edit-form')")
                    assert session.js("return document.activeElement===arguments[0]", {ELEMENT: source_hitbox}), "Choosing the edge source retains native button focus"
                    session.js("arguments[0].focus();", {ELEMENT: target_hitbox})
                    key(" ")
                    session.wait("return JSON.parse(localStorage.getItem('graph-editor-graph')||'null')?.edges.length===1")
                    keyboard_edge = session.js("""const g=JSON.parse(localStorage.getItem('graph-editor-graph'));return {
                        edge:g.edges[0],nodeCount:g.nodes.length,inlineEditorOpen:!!document.querySelector('.ge-inline-edit-form'),
                        targetFocus:document.activeElement===arguments[0]};""", {ELEMENT: target_hitbox})
                    assert keyboard_edge["nodeCount"] == 2 and keyboard_edge["targetFocus"] and not keyboard_edge["inlineEditorOpen"], keyboard_edge
                    assert keyboard_edge["edge"]["source"] == created_nodes[0]["id"] and keyboard_edge["edge"]["target"] == created_nodes[1]["id"], keyboard_edge
                    capture("keyboard-edge")

                    session.open_panel(m["load"], "starter")
                    session.wait("return document.querySelector('[data-editor-panel=starter]')?.contains(document.activeElement)")
                    labels = session.js("""const p=document.querySelector('[data-editor-panel=starter]');
                        return ['textarea','select'].map(selector=>{const e=p.querySelector(selector);
                            const labels=[...e.labels].map(l=>({text:l.textContent.trim(),visible:!!l.getClientRects().length}));
                            const descriptions=(e.getAttribute('aria-describedby')||'').split(/\\s+/).filter(Boolean)
                                .map(id=>({id,text:document.getElementById(id)?.textContent.trim()||null}));
                            return {control:selector,id:e.id,labels,descriptions};});""")
                    assert any(label["text"] == m["input"] and label["visible"] for label in labels[0]["labels"]), labels
                    assert any(label["text"] == m["format"] and label["visible"] for label in labels[1]["labels"]), labels
                    assert labels[0]["descriptions"] and all(d["text"] for d in labels[0]["descriptions"]), labels
                    session.click(session.element("[data-editor-panel=starter] label[for=" + json.dumps(labels[0]["id"]) + "]"))
                    assert session.js("return document.activeElement===document.querySelector('[data-editor-panel=starter] textarea')"), "Visible data label focuses its textarea"

                    example_summary = session.element("[data-editor-panel=starter] [data-import-example] summary")
                    session.js("arguments[0].focus();", {ELEMENT: example_summary})
                    key("\ue007")
                    session.wait("return document.querySelector('[data-import-example]')?.open")
                    input_example = session.js("""const box=document.querySelector('[data-import-example]');
                        return {label:box.querySelector('pre').getAttribute('aria-label'),text:box.querySelector('pre').textContent,
                            useButton:box.querySelector('button')?.textContent.trim()};""")
                    assert input_example["label"] == m["example"] and input_example["useButton"] == m["useExample"], input_example
                    session.activate(session.element("[data-import-example] button"))
                    session.wait("return document.querySelector('[data-editor-panel=starter] textarea')?.value===" + json.dumps(input_example["text"]))
                    assert session.js("return document.querySelector('[data-import-example]')?.open&&!document.querySelector('[data-import-example] button')&&document.activeElement===document.querySelector('[data-editor-panel=starter] textarea')"), "Using an example preserves its reference and focuses the editor"

                    replace_input("")
                    session.wait("return !!document.querySelector('[data-import-example] button')")
                    session.click(session.element('[data-editor-panel=starter] option[value="json"]'))
                    session.wait("return document.querySelector('[data-editor-panel=starter] select')?.value==='json'")
                    json_example = session.js("return document.querySelector('[data-import-example] pre')?.textContent")
                    parsed_example = json.loads(json_example)
                    assert parsed_example["version"] == 1 and len(parsed_example["nodes"]) == 2 and len(parsed_example["edges"]) == 1, parsed_example
                    session.activate(session.element("[data-import-example] button"))
                    session.wait("const p=document.querySelector('[data-editor-panel=starter]');return p.querySelector('textarea').value===" + json.dumps(json_example) + "&&!p.querySelector('textarea').getAttribute('aria-invalid')&&![...p.querySelectorAll('button')].at(-1).disabled")
                    input_example["jsonValid"] = True
                    input_example["jsonNodeCount"] = len(parsed_example["nodes"])
                    capture("input-example")

                    replace_input('{"version":2}')
                    session.wait("return document.querySelector('[data-editor-panel=starter] textarea')?.getAttribute('aria-invalid')==='true'")
                    invalid = session.js("""const p=document.querySelector('[data-editor-panel=starter]');const e=p.querySelector('textarea');
                        const ids=e.getAttribute('aria-describedby').split(/\\s+/);const issue=document.getElementById(ids.at(-1));
                        const probe=document.createElement('span');probe.style.borderColor='var(--danger)';p.append(probe);
                        const danger=getComputedStyle(probe).borderColor;probe.remove();
                        return {invalid:e.getAttribute('aria-invalid'),border:getComputedStyle(e).borderColor,danger,
                            descriptions:ids.map(id=>({id,text:document.getElementById(id)?.textContent.trim()})),
                            issueRole:issue?.getAttribute('role'),issueLive:issue?.getAttribute('aria-live'),
                            exampleOpen:p.querySelector('[data-import-example]').open,
                            exampleUseButton:!!p.querySelector('[data-import-example] button'),
                            applyDisabled:[...p.querySelectorAll('button')].at(-1).disabled};""")
                    assert invalid["applyDisabled"] and invalid["issueRole"] is None and invalid["issueLive"] is None, invalid
                    assert invalid["exampleOpen"] and not invalid["exampleUseButton"], invalid
                    assert invalid["border"] == invalid["danger"], invalid
                    assert len(invalid["descriptions"]) == 2 and all(d["text"] for d in invalid["descriptions"]), invalid
                    invalid_geometry = panel_geometry("starter")
                    capture("invalid")

                    # Real malformed contest edge rows exercise the same partial-input
                    # diagnostics as starter-input-ui, with five distinct line errors.
                    session.click(session.element('[data-editor-panel=starter] option[value="contest-edge-list"]'))
                    session.wait("return document.querySelector('[data-editor-panel=starter] select')?.value==='contest-edge-list'")
                    replace_input("4 6\n1 2\n1\n2\n3\n4\n5")
                    session.wait("return document.querySelectorAll('[data-editor-panel=starter] [data-import-diagnostics] li').length===2")
                    summary = session.element("[data-editor-panel=starter] [data-import-diagnostics] summary")
                    session.js("arguments[0].focus();", {ELEMENT: summary})
                    key("\ue007")
                    session.wait("return document.querySelector('[data-editor-panel=starter] [data-import-diagnostics]')?.open")
                    warnings = session.js("""const p=document.querySelector('[data-editor-panel=starter]');const e=p.querySelector('textarea');
                        const id=e.getAttribute('aria-describedby').split(/\\s+/).at(-1);const box=document.getElementById(id);
                        return {invalid:e.getAttribute('aria-invalid'),applyDisabled:[...p.querySelectorAll('button')].at(-1).disabled,
                            role:box.getAttribute('role'),live:box.getAttribute('aria-live'),primaryCount:[...box.children].filter(e=>e.tagName==='DIV').length,
                            expanded:p.querySelector('[data-import-diagnostics]').open,remaining:[...p.querySelectorAll('[data-import-diagnostics] li')].map(e=>({text:e.textContent.trim(),visible:!!e.getClientRects().length})),
                            summary:p.querySelector('[data-import-diagnostics] summary').textContent.trim()};""")
                    assert warnings["invalid"] is None and not warnings["applyDisabled"] and warnings["role"] is None and warnings["live"] is None, warnings
                    assert warnings["primaryCount"] == 3 and warnings["expanded"] and len(warnings["remaining"]) == 2, warnings
                    assert all(item["text"] and item["visible"] for item in warnings["remaining"]), warnings
                    warning_geometry = panel_geometry("starter")
                    capture("diagnostics")

                    replace_input("4 4\n0 1\n1 2\n1 3\n2 3")
                    session.wait("const p=document.querySelector('[data-editor-panel=starter]');return p&&!p.querySelector('[data-import-diagnostics]')&&p.querySelector('[data-import-example]').open&&![...p.querySelectorAll('button')].at(-1).disabled")
                    apply_button = session.button(m["apply"])
                    session.js("arguments[0].focus();", {ELEMENT: apply_button})
                    key("\ue007")
                    session.wait("return document.querySelectorAll('button.ge-select-node-hitbox').length===4&&!document.querySelector('[data-editor-panel=starter]')")

                    session.open_panel(m["export"], "export")
                    session.wait("return !!document.querySelector('[data-editor-panel=export] pre')?.textContent.trim()")
                    export_format = session.element("[data-editor-panel=export] select")
                    session.js("arguments[0].focus();", {ELEMENT: export_format})
                    key("\ue004")
                    session.wait("return document.activeElement===document.querySelector('[data-editor-panel=export] pre')")
                    output = session.js("""const e=document.activeElement;const s=getComputedStyle(e);
                        return {tag:e.tagName,role:e.getAttribute('role'),label:e.getAttribute('aria-label'),tabIndex:e.tabIndex,
                            documentFocused:document.hasFocus(),outlineStyle:s.outlineStyle,outlineWidth:s.outlineWidth,text:e.textContent.trim()};""")
                    assert output["role"] == "region" and output["label"] and output["tabIndex"] == 0, output
                    output["appearanceChecked"] = output["documentFocused"]
                    if output["appearanceChecked"]:
                        assert output["outlineStyle"] != "none" and float(output["outlineWidth"].removesuffix("px")) >= 2, output
                    export_geometry = panel_geometry("export")
                    capture("export-focus")
                    close_panel("export")

                    settings_panel = "menu" if dimensions["layout"] == "mobile" else "settings"
                    settings_button = session.element(f'[data-editor-panel-trigger="{settings_panel}"]')
                    session.js("arguments[0].focus();", {ELEMENT: settings_button})
                    key("\ue007")
                    session.wait("return !!document.querySelector(arguments[0])".replace(
                        "arguments[0]", json.dumps(f"[data-editor-panel={settings_panel}]")))
                    settings_geometry = panel_geometry(settings_panel)
                    checkboxes = session.js("""return [...document.querySelectorAll(arguments[0]+' [role=checkbox]')].map(e=>({
                        label:(e.getAttribute('aria-labelledby')||'').split(/\\s+/).map(id=>document.getElementById(id)?.textContent.trim()||'').join(' '),
                        checked:e.getAttribute('aria-checked'),height:e.getBoundingClientRect().height}));""", f"[data-editor-panel={settings_panel}]")
                    assert len(checkboxes) >= 2 and all(c["label"] and c["checked"] in ("true", "false") and c["height"] >= 44 for c in checkboxes), checkboxes
                    checkbox = session.element(f"[data-editor-panel={settings_panel}] [role=checkbox]")
                    session.js("arguments[0].focus();", {ELEMENT: checkbox})
                    key(" ")
                    session.wait("return document.querySelector(arguments[0]).getAttribute('aria-checked')!==".replace(
                        "arguments[0]", json.dumps(f"[data-editor-panel={settings_panel}] [role=checkbox]")) + json.dumps(checkboxes[0]["checked"]))
                    capture("settings")
                    before_clear = session.js("return JSON.parse(localStorage.getItem('graph-editor-graph'))")
                    session.activate(session.element('[data-clear-trigger]'))
                    session.wait("return !!document.querySelector('[data-clear-confirmation]')&&document.activeElement===document.querySelector('[data-clear-cancel]')")
                    clear_confirmation = session.js("""const box=document.querySelector('[data-clear-confirmation]');
                        return {title:document.getElementById(box.getAttribute('aria-labelledby')).textContent.trim(),
                            description:document.getElementById(box.getAttribute('aria-describedby')).textContent.trim(),
                            cancel:document.querySelector('[data-clear-cancel]').textContent.trim(),
                            confirm:document.querySelector('[data-clear-confirm]').textContent.trim()};""")
                    assert all(clear_confirmation.values()), clear_confirmation
                    if not results:
                        time.sleep(3.2)
                        assert session.js("return !!document.querySelector('[data-clear-confirmation]')"), "Confirmation has no three-second time limit"
                    capture("clear-confirmation")
                    key("\ue007")
                    session.wait("return !document.querySelector('[data-clear-confirmation]')&&document.activeElement===document.querySelector('[data-clear-trigger]')")
                    assert session.js("return JSON.parse(localStorage.getItem('graph-editor-graph'))") == before_clear, "Enter on initial Cancel preserves graph"
                    clear_confirmation["cancelRestoresFocusAndGraph"] = True
                    close_panel(settings_panel)

                    # Clearing returns to Select. Re-enter node mode while its
                    # toast is visible, then restore the exact graph with Undo.
                    session.activate(session.button(m["modes"][1]))
                    session.activate(session.element(f'[data-editor-panel-trigger="{settings_panel}"]'))
                    session.wait("return !!document.querySelector('[data-clear-trigger]')")
                    session.activate(session.element('[data-clear-trigger]'))
                    session.wait("return !!document.querySelector('[data-clear-confirm]')")
                    press_feedback = None
                    if not results:
                        cancel = session.element('[data-clear-cancel]')
                        session.focus_window()
                        session.command("POST", "/actions", {"actions": [{"type": "pointer", "id": "press-review", "parameters": {"pointerType": "mouse"}, "actions": [
                            {"type": "pointerMove", "origin": {ELEMENT: cancel}, "x": 0, "y": 0},
                            {"type": "pointerDown", "button": 0}]}]})
                        try:
                            press_feedback = session.js("""const e=document.querySelector('[data-clear-cancel]');const s=getComputedStyle(e);
                                return {active:e.matches(':active'),background:s.backgroundImage,transform:s.transform};""")
                            assert press_feedback["active"] and "linear-gradient" in press_feedback["background"], press_feedback
                            assert press_feedback["transform"] == "none", press_feedback
                            capture("button-press")
                        finally:
                            session.command("POST", "/actions", {"actions": [{"type": "pointer", "id": "press-review", "parameters": {"pointerType": "mouse"}, "actions": [{"type": "pointerUp", "button": 0}]}]})
                        session.wait("return !document.querySelector('[data-clear-confirmation]')")
                        session.activate(session.element('[data-clear-trigger]'))
                        session.wait("return !!document.querySelector('[data-clear-confirm]')")
                    session.activate(session.element('[data-clear-confirm]'))
                    session.wait("return !document.querySelector('[data-editor-panel]')&&JSON.parse(localStorage.getItem('graph-editor-graph')||'null')?.nodes.length===0")
                    toast_geometry = None
                    if dimensions["layout"] == "mobile":
                        session.activate(session.button(m["modes"][1]))
                        session.wait("return !!document.querySelector('[data-node-creation-action] button')")
                        toast_geometry = session.js("""const toast=document.querySelector('[data-editor-toast]');
                            const action=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===arguments[0]);
                            const t=toast?.getBoundingClientRect();const a=action?.getBoundingClientRect();
                            return {toastBottom:t?.bottom,actionTop:a?.top,toastText:toast?.textContent.trim(),
                                contentWidth:toast?.scrollWidth,viewportWidth:innerWidth};""", m["addNode"])
                        assert toast_geometry["toastText"] and toast_geometry["toastBottom"] <= toast_geometry["actionTop"], toast_geometry
                        assert toast_geometry["contentWidth"] <= toast_geometry["viewportWidth"], toast_geometry
                        capture("clear-toast")
                    session.activate(session.button(m["undo"]))
                    session.wait("return JSON.parse(localStorage.getItem('graph-editor-graph')||'null')?.nodes.length===4")
                    assert session.js("return JSON.parse(localStorage.getItem('graph-editor-graph'))") == before_clear, "Undo restores every node, edge and setting after clear"
                    clear_confirmation["undoRestoresGraph"] = True

                    session.open_panel(m["image"], "png")
                    session.wait("return !!document.querySelector('[data-editor-panel=png] img')")
                    ranges = session.js("""return [...document.querySelectorAll('[data-editor-panel=png] input[type=range]')].map(e=>({
                        id:e.id,label:[...e.labels].map(l=>l.textContent.trim()).join(' '),value:e.value,
                        valueText:e.getAttribute('aria-valuetext'),output:document.querySelector('output[for="'+e.id+'"]')?.textContent.trim()}));""")
                    assert len(ranges) == 2 and all(r["label"] and r["valueText"] == r["value"] + " px" and "px" in (r["output"] or "") for r in ranges), ranges
                    slider = session.element("[data-editor-panel=png] input[type=range]")
                    session.js("arguments[0].focus();", {ELEMENT: slider})
                    key("\ue014")
                    session.wait("const e=document.querySelector('[data-editor-panel=png] input[type=range]');return e.value!==" + json.dumps(ranges[0]["value"]) + "&&e.getAttribute('aria-valuetext')===e.value+' px'")
                    session.wait("return !!document.querySelector('[data-editor-panel=png] img')")
                    png_geometry = panel_geometry("png")
                    capture("png")

                    session.activate(session.button(m["fixedCanvas"]))
                    session.wait("return document.querySelectorAll('[data-editor-panel=png] input[type=number]').length===2")
                    canvas_dimensions = session.js("""return [...document.querySelectorAll('[data-editor-panel=png] input[type=number]')].map(e=>({
                        id:e.id,value:e.value,label:[...e.labels].map(l=>l.textContent.trim()).join(' '),
                        inputMode:e.inputMode,description:(e.getAttribute('aria-describedby')||'').split(/\\s+/)
                            .map(id=>document.getElementById(id)?.textContent.trim()).join(' ')}));""")
                    assert all(item["label"] and item["inputMode"] == "numeric" and "1–3840 px" in item["description"]
                               for item in canvas_dimensions), canvas_dimensions
                    width_input = session.element('[data-editor-panel=png] input[id=' + json.dumps(canvas_dimensions[0]["id"]) + ']')
                    height_input = session.element('[data-editor-panel=png] input[id=' + json.dumps(canvas_dimensions[1]["id"]) + ']')
                    clear_input(width_input)
                    session.wait("return document.querySelectorAll('[data-editor-panel=png] input[type=number]')[0].value===''")
                    key("\ue004")
                    session.wait("return document.querySelectorAll('[data-editor-panel=png] input[type=number]')[0].value===" + json.dumps(canvas_dimensions[0]["value"]))
                    clear_input(width_input)
                    session.wait("return document.querySelectorAll('[data-editor-panel=png] input[type=number]')[0].value===''")
                    session.command("POST", f"/element/{width_input}/value", {"text": "1280"})
                    key("\ue004")
                    session.wait("return document.querySelector('[data-editor-panel=png] img')?.naturalWidth===1280")
                    clear_input(height_input)
                    session.wait("return document.querySelectorAll('[data-editor-panel=png] input[type=number]')[1].value===''")
                    session.command("POST", f"/element/{height_input}/value", {"text": "720"})
                    key("\ue007")
                    session.wait("const img=document.querySelector('[data-editor-panel=png] img');return img?.naturalWidth===1280&&img?.naturalHeight===720")
                    committed_dimensions = session.js("""const p=document.querySelector('[data-editor-panel=png]');const img=p.querySelector('img');
                        return {values:[...p.querySelectorAll('input[type=number]')].map(e=>e.value),
                            width:img.naturalWidth,height:img.naturalHeight,focusedHeight:document.activeElement===p.querySelectorAll('input[type=number]')[1]};""")
                    assert committed_dimensions["values"] == ["1280", "720"] and committed_dimensions["focusedHeight"], committed_dimensions

                    # A real pointer action must commit the draft during blur
                    # before its own setting change. Do not insert Tab/Enter.
                    session.focus_window()
                    clear_input(width_input)
                    session.command("POST", f"/element/{width_input}/value", {"text": "1440"})
                    session.wait("return document.querySelectorAll('[data-editor-panel=png] input[type=number]')[0].value==='1440'")
                    background_button = session.button(m["transparent"])
                    session.js("""window.__pngCommitEvents=[];const input=arguments[0],button=arguments[1];
                        input.addEventListener('blur',()=>window.__pngCommitEvents.push({type:'blur',value:input.value}),{once:true});
                        button.addEventListener('click',()=>window.__pngCommitEvents.push({type:'click',value:input.value}),{once:true});""",
                        {ELEMENT: width_input}, {ELEMENT: background_button})
                    session.click(background_button)
                    session.wait("const p=document.querySelector('[data-editor-panel=png]');const img=p.querySelector('img');const b=[...p.querySelectorAll('[role=radio]')].find(e=>e.textContent.trim()===" + json.dumps(m["transparent"]) + ");return b?.getAttribute('aria-checked')==='true'&&img?.naturalWidth===1440&&img?.naturalHeight===720")
                    click_commit = session.js("""const p=document.querySelector('[data-editor-panel=png]');const img=p.querySelector('img');return {
                        events:window.__pngCommitEvents,values:[...p.querySelectorAll('input[type=number]')].map(e=>e.value),
                        width:img.naturalWidth,height:img.naturalHeight};""")
                    assert [event["type"] for event in click_commit["events"]] == ["blur", "click"], click_commit
                    assert click_commit["values"] == ["1440", "720"], click_commit
                    fixed_geometry = panel_geometry("png")
                    capture("png-dimensions")
                    long_export_gutter = None
                    if not results:
                        close_panel("png")
                        session.open_panel(m["load"], "starter")
                        session.click(session.element('[data-editor-panel=starter] option[value="contest-edge-list"]'))
                        session.wait("return document.querySelector('[data-editor-panel=starter] select')?.value==='contest-edge-list'")
                        replace_input("1000 0")
                        session.wait("const p=document.querySelector('[data-editor-panel=starter]');return p&&!p.querySelector('textarea').getAttribute('aria-invalid')&&![...p.querySelectorAll('button')].at(-1).disabled")
                        session.activate(session.button(m["apply"]))
                        session.wait("const g=JSON.parse(localStorage.getItem('graph-editor-graph')||'null');return g?.nodes.length===1000&&g?.edges.length===0&&!document.querySelector('[data-editor-panel=starter]')")
                        session.open_panel(m["export"], "export")
                        session.click(session.element('[data-editor-panel=export] option[value="adjacency-list"]'))
                        session.wait("const p=document.querySelector('[data-editor-panel=export]');return p.querySelector('select').value==='adjacency-list'&&p.querySelector('pre').textContent.trim().split('\\n').length>=1000")
                        previous_font_size = session.js("return document.documentElement.style.fontSize")
                        try:
                            session.js("document.documentElement.style.fontSize='24px';")
                            session.wait("return getComputedStyle(document.documentElement).fontSize==='24px'")
                            session.js("""const pre=document.querySelector('[data-editor-panel=export] pre');
                                pre.previousElementSibling.lastElementChild.scrollIntoView({block:'end',inline:'nearest',behavior:'instant'});""")
                            long_export_gutter = session.wait("""const panel=document.querySelector('[data-editor-panel=export]'),pre=panel.querySelector('pre');
                                const gutter=pre.previousElementSibling,chunk=gutter.lastElementChild,text=chunk?.firstChild;
                                if(!text||text.nodeType!==Node.TEXT_NODE)return false;
                                const digits=text.textContent.match(/\\d{4,}(?=\\s*$)/)?.[0];if(!digits)return false;
                                const range=document.createRange(),start=text.textContent.lastIndexOf(digits);
                                range.setStart(text,start);range.setEnd(text,start+digits.length);
                                const r=range.getBoundingClientRect();if(!r.width||!r.height)return false;
                                const box=e=>{const b=e.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height};};
                                const owner=pre.closest('.ge-scrollbar');return {lineNumber:digits,lineCount:pre.textContent.trim().split('\\n').length,
                                    text:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height},
                                    gutter:box(gutter),grid:box(pre.parentElement),panel:box(panel),scrollOwner:box(owner),scrollTop:owner.scrollTop,
                                    viewportWidth:innerWidth,fontSize:getComputedStyle(document.documentElement).fontSize,
                                    limits:['One Japanese/light editor case with 1000 isolated nodes in adjacency-list format and 24 px root text; no file download or clipboard operation']};""")
                            number_bounds = long_export_gutter["text"]
                            gutter_bounds = long_export_gutter["gutter"]
                            grid_bounds = long_export_gutter["grid"]
                            panel_bounds = long_export_gutter["panel"]
                            owner_bounds = long_export_gutter["scrollOwner"]
                            assert long_export_gutter["lineCount"] >= 1000 and len(long_export_gutter["lineNumber"]) >= 4, long_export_gutter
                            assert number_bounds["left"] >= gutter_bounds["left"] - 1 and number_bounds["right"] <= gutter_bounds["right"] + 1, long_export_gutter
                            assert grid_bounds["left"] >= panel_bounds["left"] - 1 and grid_bounds["right"] <= panel_bounds["right"] + 1, long_export_gutter
                            assert panel_bounds["left"] >= -1 and panel_bounds["right"] <= long_export_gutter["viewportWidth"] + 1, long_export_gutter
                            assert number_bounds["top"] >= owner_bounds["top"] - 1 and number_bounds["bottom"] <= owner_bounds["bottom"] + 1 and long_export_gutter["scrollTop"] > 0, long_export_gutter
                            capture("long-export-gutter")
                        finally:
                            session.js("document.documentElement.style.fontSize=arguments[0];", previous_font_size)
                    results.append({**current_case, "viewport": dimensions, "labels": labels, "invalidInput": invalid,
                        "clearConfirmation": clear_confirmation, "toastGeometry": toast_geometry, "pressFeedback": press_feedback,
                        "sampleControls": sample_controls, "sampleResetFocus": "passed",
                        "diagnostics": warnings, "outputKeyboardFocus": output, "checkboxes": checkboxes, "sliders": ranges,
                        "inputExample": input_example, "mobileModeLabels": mobile_mode_labels, "helpMenu": help_menu,
                        "nodeCreation": node_action, "keyboardEdge": keyboard_edge,
                        "pngDimensionFields": canvas_dimensions, "pngCommittedDimensions": committed_dimensions,
                        "pngClickCommit": click_commit,
                        "longExportGutter": long_export_gutter,
                        "geometry": {"invalid": invalid_geometry, "diagnostics": warning_geometry, "export": export_geometry,
                                     "settings": settings_geometry, "png": png_geometry, "fixedCanvas": fixed_geometry}, "screenshots": screenshots,
                        "checks": ["visible input and format labels", "label click focuses data input", "help and error associations",
                                   "blocking error disables apply", "danger border", "five diagnostics remain reachable",
                                   "Enter opens persistent input example; using it focuses textarea", "example stays open while typing and cannot overwrite nonempty input",
                                   "selected JSON example is complete and accepted", "diagnostics remain associated without live interruption",
                                   "Enter expands native diagnostic disclosure", "Tab reaches output; appearance checked when window focused",
                                   "named checkbox rows and Space toggling", "named PNG ranges with px values and arrow-key updates",
                                   "fixed PNG dimensions can be cleared and typed; blur and Enter commit preview size", "empty PNG dimension restores previous value on blur",
                                   "native background click commits dimension blur before click without Tab or Enter", "Enter and Space add separate nodes with retained focus and undo/redo",
                                   "Enter chooses edge source and Space connects target without opening a label editor",
                                   "localized mobile mode captions remain inside 44 px buttons", "help precedes project and sharing links without navigation",
                                   "panel bounds and page overflow"]})
                    save("running")
                    print(f"{prefix} {dimensions}: design and accessibility review passed", flush=True)
        current_case = None
        save("passed")
        return results
    except Exception as error:
        save("failed_or_blocked", str(error))
        raise


def run_responsive_text_review(session):
    """Constrain the local editor and enlarge root text in isolated Safari."""
    messages = {
        "ja": {"path": "/", "node": "頂点", "edge": "辺", "add": "中央付近に頂点を追加", "fit": "グラフを表示領域に戻す"},
        "en": {"path": "/en", "node": "Node", "edge": "Edge", "add": "Add node near center", "fit": "Fit graph to view"},
        "zh-hans": {"path": "/zh-hans", "node": "顶点", "edge": "边", "add": "在中央附近添加顶点", "fit": "适应视图"},
    }
    results = []
    current_case = None
    original_styles = None
    report = OUTPUT / "responsive-text-results.json"

    def save(status, error=None):
        report.write_text(json.dumps({
            "status": status, "review": "Expert responsive and text-resize review in isolated installed Safari",
            "results": results, "currentCase": current_case, "error": error,
            "limits": ["The editor is constrained to an exact CSS box inside a desktop Safari window; this is a viewport simulation",
                       "24 px root text simulates text enlargement; no operating-system or browser accessibility setting is changed",
                       "Every primary toolbar control has a 44 px minimum; the separate range-menu trigger is a pointer-only exception with a 24 px minimum",
                       "The range-menu trigger is absent on actual touch platforms; this desktop Safari session retains it",
                       "Node body size, rendered circles, hitbox centers and chrome bounds are measured from the current rendered state",
                       "The optional insufficient-space guard is reported only if its action remains visible and unobscured"],
        }, indent=2, ensure_ascii=False))

    def key(value):
        session.command("POST", "/actions", {"actions": [{"type": "key", "id": "responsive-keyboard", "actions": [
            {"type": "keyDown", "value": value}, {"type": "keyUp", "value": value}]}]})

    def overlaps(a, b):
        return min(a["right"], b["right"]) - max(a["left"], b["left"]) > 1 and min(a["bottom"], b["bottom"]) - max(a["top"], b["top"]) > 1

    def contains(outer, inner):
        return (inner["left"] >= outer["left"] - 1 and inner["right"] <= outer["right"] + 1
                and inner["top"] >= outer["top"] - 1 and inner["bottom"] <= outer["bottom"] + 1)

    def inspect_chrome():
        return session.js("""const box=e=>{const r=e.getBoundingClientRect();return {
            left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
            const main=document.querySelector('main'),root=document.querySelector('[data-layout]');
            const top=root.querySelector('[data-editor-chrome-top]'),bottom=root.querySelector('[data-editor-chrome-bottom]');
            const rows=[top,bottom].filter(Boolean);const visible=e=>!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
            return {main:box(main),root:box(root),fontSize:getComputedStyle(document.documentElement).fontSize,
                layout:root.dataset.layout,window:{width:innerWidth,height:innerHeight,devicePixelRatio},
                nodeSizeToken:getComputedStyle(root).getPropertyValue('--canvas-node-size').trim(),
                measuredInsets:{top:root.style.getPropertyValue('--ge-top-chrome-bottom'),bottom:root.style.getPropertyValue('--ge-mobile-controls-bottom')},
                rows:rows.map((row,index)=>({name:index?'bottom':'top',bounds:box(row)})),
                surfaces:rows.flatMap((row,index)=>[...(row.matches('.ge-panel')?[row]:row.querySelectorAll('.ge-panel'))]
                    .filter(visible).map(e=>({row:index?'bottom':'top',bounds:box(e)}))),
                controls:rows.flatMap((row,index)=>[...row.querySelectorAll('button')].filter(visible).map(e=>{
                    const text=[];const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let node;
                    while(node=walker.nextNode()){
                        if(!node.textContent.trim()||node.parentElement.closest('svg,.sr-only'))continue;
                        const range=document.createRange();range.selectNodeContents(node);
                        for(const r of range.getClientRects())if(r.width&&r.height)text.push({text:node.textContent.trim(),
                            left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height});
                    }
                    return {row:index?'bottom':'top',label:e.getAttribute('aria-label')||e.textContent.trim(),bounds:box(e),text,
                        pointerOnlyRangeMenu:e.hasAttribute('data-range-selection-trigger'),disabled:e.disabled};
                }))};""")

    def assert_chrome(geometry, font_size, width, height):
        expected_layout = "mobile" if width < 768 else "desktop"
        assert geometry["layout"] == expected_layout and geometry["fontSize"] == f"{font_size}px", geometry
        for name in ("main", "root"):
            assert abs(geometry[name]["width"] - width) <= 1 and abs(geometry[name]["height"] - height) <= 1, geometry
        row_bounds = {row["name"]: row["bounds"] for row in geometry["rows"]}
        if expected_layout == "mobile":
            assert "bottom" in row_bounds and not overlaps(row_bounds["top"], row_bounds["bottom"]), geometry
        else:
            assert "bottom" not in row_bounds, geometry
        for control in geometry["controls"]:
            bounds = control["bounds"]
            minimum_width = 24 if control["pointerOnlyRangeMenu"] else 44
            assert bounds["width"] >= minimum_width - 1 and bounds["height"] >= 44 - 1, control
            assert contains(geometry["root"], bounds) and contains(row_bounds[control["row"]], bounds), control
            assert all(contains(bounds, text) for text in control["text"]), control
        for index, surface in enumerate(geometry["surfaces"]):
            assert contains(geometry["root"], surface["bounds"]), surface
            assert all(not overlaps(surface["bounds"], other["bounds"]) for other in geometry["surfaces"][index + 1:]), geometry["surfaces"]

    def restore_styles():
        nonlocal original_styles
        if original_styles is not None:
            session.js("""const main=document.querySelector('main');main.style.width=arguments[0].width;
                main.style.height=arguments[0].height;document.documentElement.style.fontSize=arguments[0].fontSize;""", original_styles)
            original_styles = None

    save("running")
    try:
        for locale, m in messages.items():
            for theme in ("light", "dark"):
                for font_size, width, height in ((16, 320, 390), (24, 320, 900), (24, 1280, 900)):
                    window_width = 600 if width < 768 else 1440
                    expected_layout = "mobile" if width < 768 else "desktop"
                    current_case = {"locale": locale, "theme": theme, "rootFontPx": font_size,
                                    "requestedEditorWidth": width, "requestedEditorHeight": height,
                                    "requestedWindowWidth": window_width, "requestedWindowHeight": 1000}
                    save("running")
                    session.command("POST", "/window/rect", {"width": window_width, "height": 1000}, check=False)
                    session.navigate(m["path"])
                    session.js("localStorage.clear();localStorage.setItem('graph-editor-theme',arguments[0]);", theme)
                    session.refresh()
                    session.wait("return !!document.querySelector('[data-canvas-ready=true]')")
                    original_styles = session.js("const main=document.querySelector('main');return {width:main.style.width,height:main.style.height,fontSize:document.documentElement.style.fontSize};")
                    session.js("const main=document.querySelector('main');document.documentElement.style.fontSize=arguments[0]+'px';main.style.width=arguments[1]+'px';main.style.height=arguments[2]+'px';", font_size, width, height)
                    session.wait("""const root=document.querySelector('[data-layout]');const r=root.getBoundingClientRect();
                        const top=root.querySelector('[data-editor-chrome-top]')?.getBoundingClientRect();
                        const bottom=root.querySelector('[data-editor-chrome-bottom]')?.getBoundingClientRect();
                        return root.dataset.layout===""" + json.dumps(expected_layout) + "&&Math.abs(r.width-" + str(width) + """ )<1&&top
                            &&Math.abs(parseFloat(root.style.getPropertyValue('--ge-top-chrome-bottom'))-(top.bottom-r.top))<1
                            &&(root.dataset.layout!=='mobile'||bottom&&Math.abs(parseFloat(root.style.getPropertyValue('--ge-mobile-controls-bottom'))-(r.bottom-bottom.top+12))<1);""")
                    session.focus_window()
                    geometry = inspect_chrome()
                    assert_chrome(geometry, font_size, width, height)
                    empty_state = session.js("""const box=e=>{const r=e.getBoundingClientRect();return {
                        left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
                        const empty=document.querySelector('[data-editor-empty-state]');
                        const scroll=empty.querySelector('.overflow-y-auto');
                        const title=empty.querySelector('button > span:last-child > span:first-child');
                        const titleText=document.createRange();titleText.selectNodeContents(title.firstElementChild);
                        const titleLines=[...titleText.getClientRects()].filter(r=>r.width&&r.height).length;
                        return {scroll:box(scroll),firstCard:box(empty.querySelector('button')),titleFontSize:getComputedStyle(title).fontSize,
                            titleLines,
                            cardCount:empty.querySelectorAll('button').length};""")
                    rows = {row["name"]: row["bounds"] for row in geometry["rows"]}
                    assert empty_state["cardCount"] == 3 and contains(geometry["root"], empty_state["scroll"]), empty_state
                    assert float(empty_state["titleFontSize"].removesuffix("px")) >= font_size * 0.8125 - 0.5, empty_state
                    assert empty_state["titleLines"] <= 2, empty_state
                    assert empty_state["scroll"]["top"] >= rows["top"]["bottom"] + 6, empty_state
                    if "bottom" in rows:
                        assert empty_state["scroll"]["bottom"] <= rows["bottom"]["top"] - 6, empty_state
                    visible_card_height = min(empty_state["scroll"]["bottom"], empty_state["firstCard"]["bottom"]) - max(empty_state["scroll"]["top"], empty_state["firstCard"]["top"])
                    assert visible_card_height >= 44, empty_state
                    empty_state["firstCardVisibleHeight"] = visible_card_height
                    prefix = f"responsive-{locale}-{theme}-root{font_size}-{width}x{height}"
                    screenshots = []

                    def capture(stage):
                        name = f"{prefix}-{stage}"
                        session.screenshot(name)
                        screenshots.append(name + ".png")

                    capture("chrome")
                    session.activate(session.button(m["node"]))
                    add_node = session.button(m["add"])
                    action_bounds = session.js("const r=document.querySelector('[data-node-creation-action] button').getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};")
                    assert contains(geometry["root"], action_bounds) and all(not overlaps(action_bounds, row["bounds"]) for row in geometry["rows"]), action_bounds
                    session.js("arguments[0].focus();", {ELEMENT: add_node})
                    for count, activation in enumerate(("\ue007", " ", "\ue007"), start=1):
                        key(activation)
                        session.wait("return JSON.parse(localStorage.getItem('graph-editor-graph')||'null')?.nodes.length===" + str(count))
                        assert session.js("return document.activeElement===arguments[0]", {ELEMENT: add_node}), "Repeated responsive creation retains action focus"
                    capture("node-action")
                    session.activate(session.button(m["edge"]))
                    session.wait("return document.querySelectorAll('button[data-edge-node-hitbox=true]').length===3")
                    nodes = session.js(RANGE_CY + """const c=container.getBoundingClientRect();const targets=[...document.querySelectorAll('button[data-edge-node-hitbox=true]')];
                        return cy.nodes().map((node,index)=>{const r=targets[index].getBoundingClientRect();const p=node.renderedPosition();return {
                            label:node.data('displayLabel'),x:r.left+r.width/2,y:r.top+r.height/2,
                            rendererX:p.x+c.left,rendererY:p.y+c.top,bodyWidth:node.width(),bodyHeight:node.height(),
                            renderedWidth:node.renderedWidth(),renderedHeight:node.renderedHeight(),
                            outerWidth:node.outerWidth()*cy.zoom(),outerHeight:node.outerHeight()*cy.zoom(),zoom:cy.zoom()};});""")
                    for index, node in enumerate(nodes):
                        assert abs(node["bodyHeight"] - 3 * font_size) <= 1 and abs(node["renderedHeight"] - 3 * font_size) <= 1, node
                        assert abs(node["bodyWidth"] - node["bodyHeight"]) <= 1, node
                        assert abs(node["x"] - node["rendererX"]) <= 1 and abs(node["y"] - node["rendererY"]) <= 1, node
                        radius = node["outerHeight"] / 2
                        circle_bounds = {"left": node["x"] - radius, "right": node["x"] + radius,
                                         "top": node["y"] - radius, "bottom": node["y"] + radius}
                        assert contains(geometry["root"], circle_bounds), node
                        for rect in [row["bounds"] for row in geometry["rows"]] + [action_bounds]:
                            nearest_x = max(rect["left"], min(node["x"], rect["right"]))
                            nearest_y = max(rect["top"], min(node["y"], rect["bottom"]))
                            assert ((node["x"] - nearest_x) ** 2 + (node["y"] - nearest_y) ** 2) ** 0.5 >= radius - 1, {"node": node, "chrome": rect}
                        for other in nodes[index + 1:]:
                            distance = ((node["x"] - other["x"]) ** 2 + (node["y"] - other["y"]) ** 2) ** 0.5
                            assert distance >= radius + other["outerHeight"] / 2 - 1, {"node": node, "other": other, "distance": distance}
                    capture("node-circles")
                    # Mobile only shows its rescue button after the graph has
                    # left the view. Exercise its native shortcut while visible.
                    if expected_layout == "mobile":
                        key("!")
                    else:
                        session.activate(session.button(m["fit"]))
                    fit_bounds = session.wait(RANGE_CY + """const b=cy.elements().renderedBoundingBox({includeOverlays:false});
                        const c=container.getBoundingClientRect(),root=document.querySelector('[data-layout]');
                        const top=root.querySelector('[data-editor-chrome-top]').getBoundingClientRect();
                        const bottom=root.querySelector('[data-editor-chrome-bottom]')?.getBoundingClientRect();
                        const zoom=root.querySelector('[data-canvas-zoom-controls]')?.getBoundingClientRect();
                        const bounds={left:c.left+b.x1,right:c.left+b.x2,top:c.top+b.y1,bottom:c.top+b.y2};
                        if(bounds.top<top.bottom-1||bottom&&bounds.bottom>bottom.top+1
                            ||zoom&&bounds.bottom>zoom.top+1
                            ||bounds.left<c.left-1||bounds.right>c.right+1)return false;
                        return {bounds,zoom:cy.zoom(),topChromeBottom:top.bottom,bottomChromeTop:bottom?.top??null,zoomControlsTop:zoom?.top??null};""")
                    fit_bounds["activation"] = "native ! shortcut" if expected_layout == "mobile" else "native Fit button"
                    capture("fit-to-view")
                    insufficient_space = {"status": "not_applicable", "reason": "Optional guard scenario uses a short mobile editor with 24 px root text"}
                    if font_size == 24 and width < 768:
                        session.activate(session.button(m["node"]))
                        session.js("document.querySelector('main').style.height='390px';")
                        session.wait("""const root=document.querySelector('[data-layout]');const r=root.getBoundingClientRect();
                            const top=root.querySelector('[data-editor-chrome-top]').getBoundingClientRect();
                            const bottom=root.querySelector('[data-editor-chrome-bottom]').getBoundingClientRect();
                            return Math.abs(r.height-390)<1&&Math.abs(parseFloat(root.style.getPropertyValue('--ge-top-chrome-bottom'))-(top.bottom-r.top))<1
                                &&Math.abs(parseFloat(root.style.getPropertyValue('--ge-mobile-controls-bottom'))-(r.bottom-bottom.top+12))<1;""")
                        short_geometry = inspect_chrome()
                        short_action = session.js("""const e=document.querySelector('[data-node-creation-action] button'),r=e.getBoundingClientRect();
                            const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
                            return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,
                                centerReachable:!!hit&&(hit===e||e.contains(hit))};""")
                        reachable = (contains(short_geometry["root"], short_action) and short_action["centerReachable"]
                                     and all(not overlaps(short_action, row["bounds"]) for row in short_geometry["rows"]))
                        insufficient_space = {"status": "skipped_unreachable", "editorHeight": 390,
                            "action": short_action, "rows": short_geometry["rows"],
                            "reason": "The optional short enlarged-text action is not unobscured; no guard behavior is claimed"}
                        if reachable:
                            short_add = session.button(m["add"])
                            session.js("arguments[0].focus();", {ELEMENT: short_add})
                            key("\ue007")
                            session.wait("""const e=document.querySelector('[data-node-creation-action] [role=status]');return e&&!e.classList.contains('sr-only')&&e.textContent.trim()
                                &&JSON.parse(localStorage.getItem('graph-editor-graph')||'null')?.nodes.length===3;""")
                            insufficient_space.update({"status": "passed", "reason": None,
                                "message": session.js("return document.querySelector('[data-node-creation-action] [role=status]').textContent.trim()")})
                        capture("optional-short-text")
                    results.append({**current_case, "geometry": geometry, "emptyStateGeometry": empty_state, "nodeActionBounds": action_bounds,
                        "nodes": nodes, "fitToView": fit_bounds, "screenshots": screenshots,
                        "insufficientSpaceGuard": insufficient_space,
                        "checks": ["exact local editor box and root font size", "ResizeObserver mobile/desktop layout and published chrome insets",
                                   "all visible toolbar labels remain inside their controls", "primary controls at least 44 px; pointer-only range trigger at least 24 px",
                                   "available top/bottom surfaces remain in bounds without overlap", "Enter and Space add three distinct nodes with retained focus",
                                   "first-use scroll area clears measured chrome; first card has at least 44 px visible",
                                   "Fit keeps rendered graph bounds inside the measured top/bottom chrome",
                                   "actual 48 px / 72 px node bodies and DOM hitbox centers agree", "rendered node circles avoid each other and toolbar/action bounds"]})
                    save("running")
                    restore_styles()
                    print(f"{prefix}: responsive text and node placement passed", flush=True)
        current_case = None
        save("passed")
        return results
    except Exception as error:
        save("failed_or_blocked", str(error))
        raise
    finally:
        restore_styles()


def run_editor_review(session):
    messages = {
        "ja": {"path": "/", "load": "グラフを読み込む", "apply": "グラフに反映", "export": "書き出し", "image": "PNG 画像", "color": "頂点の色", "green": "頂点の色: 緑"},
        "en": {"path": "/en", "load": "Load a graph", "apply": "Apply to graph", "export": "Export", "image": "PNG image", "color": "Node color", "green": "Node color: Green"},
        "zh-hans": {"path": "/zh-hans", "load": "加载图", "apply": "应用到图", "export": "导出", "image": "PNG 图像", "color": "顶点颜色", "green": "顶点颜色：绿色"},
    }
    results = []
    for locale in ("zh-hans", "ja", "en"):
        m = messages[locale]
        for width in (600, 960, 1440):
            for theme in ("light", "dark"):
                if results:
                    session.restart()
                session.command("POST", "/window/rect", {"width": width, "height": 1000}, check=False)
                session.navigate(m["path"])
                # Reset only this isolated Safari automation session's local state.
                session.js("localStorage.clear(); localStorage.setItem('graph-editor-theme',arguments[0]);", theme)
                session.refresh()
                session.wait("return !!document.querySelector('[data-canvas-ready=true]')")
                dimensions = session.js("return {width:innerWidth,height:innerHeight}")
                prefix = f"safari-{locale}-{theme}-{width}"
                session.screenshot(prefix + "-empty")
                session.focus_window()
                opener = session.button(m["load"])
                session.js("arguments[0].focus()", {ELEMENT: opener})
                session.command("POST", "/actions", {"actions": [{"type": "key", "id": "keyboard", "actions": [
                    {"type": "keyDown", "value": "\ue007"}, {"type": "keyUp", "value": "\ue007"}]}]})
                session.wait("const p=document.querySelector('[data-editor-panel=starter]');return p&&p!==document.activeElement&&p.contains(document.activeElement)")
                session.js("window.__editorTabStart=document.activeElement;")
                session.command("POST", "/actions", {"actions": [{"type": "key", "id": "keyboard", "actions": [
                    {"type": "keyDown", "value": "\ue004"}, {"type": "keyUp", "value": "\ue004"}]}]})
                session.wait("return document.activeElement!==window.__editorTabStart&&document.querySelector('[data-editor-panel=starter]')?.contains(document.activeElement)")
                session.command("POST", "/actions", {"actions": [{"type": "key", "id": "keyboard", "actions": [
                    {"type": "keyDown", "value": "\ue00c"}, {"type": "keyUp", "value": "\ue00c"}]}]})
                session.wait("return !document.querySelector('[data-editor-panel=starter]')")
                session.wait("return document.activeElement.getAttribute('aria-label')===" + json.dumps(m["load"]))
                session.open_panel(m["load"], "starter")
                session.js("window.__focusTrace=[];document.addEventListener('focusin',e=>window.__focusTrace.push({event:'focus',tag:e.target.tagName,label:e.target.getAttribute('aria-label'),time:performance.now()}));document.addEventListener('input',e=>window.__focusTrace.push({event:'input',tag:e.target.tagName,value:e.target.value,time:performance.now()}));")
                textarea = session.element("textarea")
                session.command("POST", f"/element/{textarea}/value", {"text": "4 4\n1 2\n2 3\n2 4\n3 4"})
                session.wait("return [...document.querySelectorAll('[data-editor-panel=starter] button')].some(e=>e.textContent.trim()===" + json.dumps(m["apply"]) + "&&!e.disabled)")
                session.screenshot(prefix + "-import")
                session.activate(session.button(m["apply"]))
                session.wait("return document.querySelectorAll('button.ge-select-node-hitbox').length===4&&!document.querySelector('[data-editor-panel=starter]')")
                session.activate(session.element("button.ge-select-node-hitbox"))
                mobile = session.js("return document.querySelector('[data-layout]').dataset.layout==='mobile'")
                if mobile:
                    session.activate(session.button(m["color"]))
                session.activate(session.button(m["green"]))
                session.wait("return JSON.parse(localStorage.getItem('graph-editor-graph')).nodes[0].color==='green'")
                if mobile:
                    range_key(session, "\ue00c")
                    session.wait("return !document.querySelector('[role=radiogroup]')")
                before = session.js("return JSON.parse(localStorage.getItem('graph-editor-graph')).nodes[0]")
                node = session.element("button.ge-select-node-hitbox")
                session.command("POST", "/actions", {"actions": [{"type": "pointer", "id": "mouse", "parameters": {"pointerType": "mouse"}, "actions": [
                    {"type": "pointerMove", "duration": 0, "origin": {ELEMENT: node}, "x": 0, "y": 0},
                    {"type": "pointerDown", "button": 0},
                    {"type": "pointerMove", "duration": 400, "origin": "pointer", "x": 40, "y": 20},
                    {"type": "pointerUp", "button": 0}]}]})
                session.wait("return JSON.parse(localStorage.getItem('graph-editor-graph')).nodes[0].x!==" + str(before["x"]))
                session.open_panel(m["export"], "export")
                session.click(session.element('[data-editor-panel=export] option[value="json"]'))
                text = session.wait("const e=document.querySelector('[data-editor-panel=export] pre');return e&&e.textContent.trim().startsWith('{')&&e.textContent;")
                graph = json.loads(text)
                assert len(graph["nodes"]) == 4 and graph["nodes"][0]["color"] == "green"
                assert graph["nodes"][0]["x"] != before["x"]
                (OUTPUT / f"{prefix}-export.json").write_text(text)
                session.screenshot(prefix + "-export")
                findings = session.js("""return [...document.querySelectorAll('[data-editor-panel] button, [data-editor-chrome-control]')].flatMap(e=>{
                    const r=e.getBoundingClientRect(); return r.width&&r.height&&(r.left< -1||r.right>innerWidth+1||r.top< -1||r.bottom>innerHeight+1)?[{text:e.textContent,x:r.x,y:r.y,width:r.width,height:r.height}]:[];});""")
                assert not findings, findings
                session.open_panel(m["image"], "png")
                session.wait("return !!document.querySelector('[data-editor-panel=png] img')")
                session.screenshot(prefix + "-png")
                session.refresh()
                session.wait("return document.querySelectorAll('button.ge-select-node-hitbox').length===4")
                restored = session.js("return JSON.parse(localStorage.getItem('graph-editor-graph'))")
                assert restored["nodes"][0]["color"] == "green" and restored["nodes"][0]["x"] == graph["nodes"][0]["x"]
                results.append({"locale": locale, "theme": theme, "requestedWindowWidth": width, "viewport": dimensions, "checks": ["keyboard Enter opens panel", "Tab focus", "Escape and opener restoration", "text input after reopening", "import", "node color", "drag", "JSON export data", "PNG preview", "reload persistence", "geometry"]})
                print(f"{prefix} {dimensions}: passed", flush=True)
    return results


def routing_snapshot(session):
    """Read the actual canvas routes rather than persisted manual overrides."""
    return session.js("""
        const container = [...document.querySelectorAll('div')].find(e => '_cyreg' in e);
        const cy = container?._cyreg?.cy;
        const graph = JSON.parse(localStorage.getItem('graph-editor-graph') || 'null');
        if (!cy || !graph || cy.nodes().length !== 7 || cy.edges().length !== 6) return null;
        return {
            settings: graph.settings,
            routingCompletedAt: performance.getEntriesByName('graph-compute:routing:worker').at(-1)?.startTime ?? null,
            nodes: graph.nodes.map(({id, x, y}) => ({id, x, y})),
            edges: cy.edges().map(e => ({
                id: e.id(), source: e.data('source'), target: e.data('target'),
                bow: e.data('bow'), distances: e.data('controlPointDistances'),
                weights: e.data('controlPointWeights'),
                controlPoints: e.controlPoints(),
            })),
        };
    """)


def settled_routing(session, worker_after=None):
    # Require the saved layout and renderer data to remain unchanged for half a
    # second, so a provisional frame cannot produce either a pass or a failure.
    deadline = time.monotonic() + 15
    previous = None
    stable_since = None
    while time.monotonic() < deadline:
        snapshot = routing_snapshot(session)
        if (worker_after is not None and (snapshot is None
                or snapshot["routingCompletedAt"] is None
                or snapshot["routingCompletedAt"] < worker_after)):
            previous = None
            stable_since = None
            time.sleep(0.1)
            continue
        if snapshot is not None and snapshot == previous:
            if time.monotonic() - stable_since >= 0.5:
                return snapshot
        else:
            previous = snapshot
            stable_since = time.monotonic()
        time.sleep(0.1)
    raise AssertionError("The seven-node tree canvas routing did not settle after its requested Worker completion: "
                         + json.dumps({"workerAfter": worker_after, "snapshot": snapshot}))


def run_edge_routing_regression(session):
    """Issue #45: sample -> offset enabled -> line -> tree, using real controls."""
    results = []
    failures = []
    # Check the attached report's weighted, directed graph first. The other
    # combinations establish whether the regression depends on visible weights
    # or arrows, without changing any routing metadata from the test.
    for weighted, directed in ((True, True), (False, False), (True, False), (False, True)):
        session.command("POST", "/window/rect", {"width": 1440, "height": 1000}, check=False)
        session.navigate("/en")
        session.js("localStorage.clear(); localStorage.setItem('graph-editor-theme','light');")
        session.refresh()
        session.wait("return !!document.querySelector('[data-canvas-ready=true]')")
        session.open_panel("Settings", "settings")
        session.activate(session.button("Weighted" if weighted else "Unweighted"))
        session.activate(session.button("Directed" if directed else "Undirected"))
        session.close_panel("settings")
        session.open_panel("Load a graph", "starter")
        session.activate(session.button("Use a sample"))
        tree_card = session.element('[data-sample-kind="tree"]')
        session.js("arguments[0].scrollIntoView({block:'center'});", {ELEMENT: tree_card})
        assert session.js("return arguments[0].querySelector('input').value;", {ELEMENT: tree_card}) == "7", "Tree sample defaults to seven nodes"
        session.wait("return !!document.querySelector('[data-sample-kind=tree] [data-sample-stats]')")
        session.activate(session.element('[data-sample-kind="tree"] button[type="submit"]'))
        session.wait("return document.querySelectorAll('button.ge-select-node-hitbox').length===7&&!document.querySelector('[data-editor-panel=starter]')")
        session.open_panel("Layout", "layouts")
        offset = session.button("Offset overlapping edges")
        if session.command("GET", f"/element/{offset}/attribute/aria-checked") != "true":
            session.activate(offset)
        variant = f"{'weighted' if weighted else 'unweighted'}-{'directed' if directed else 'undirected'}"
        snapshots = []

        def record(stage, expect_straight, worker_after=None):
            snapshot = settled_routing(session, worker_after)
            assert snapshot["settings"]["weighted"] == weighted and snapshot["settings"]["directed"] == directed
            assert snapshot["settings"]["autoEdgeRouting"] is True, "Edge offset remains enabled"
            curved = [edge for edge in snapshot["edges"] if any(abs(distance) > 0.001 for distance in edge["distances"])]
            snapshot.update({"stage": stage, "curvedEdges": curved})
            snapshots.append(snapshot)
            (OUTPUT / f"issue-45-{variant}-{stage}.json").write_text(json.dumps(snapshot, indent=2))
            session.screenshot(f"issue-45-{variant}-{stage}")
            if expect_straight and curved:
                failures.append({"variant": variant, "stage": stage, "curvedEdges": curved})
            if not expect_straight and not curved:
                failures.append({"variant": variant, "stage": stage, "error": "Line layout must trigger automatic bends to exercise the regression"})
            print(f"Issue #45 {variant} {stage}: {len(curved)} curved edges, offset enabled", flush=True)
            return snapshot

        record("sample", True)
        for cycle in (1, 2):
            worker_after = session.js("return performance.now()")
            session.activate(session.button("Line: Input order"))
            record(f"line-{cycle}", False, worker_after)
            session.activate(session.button("Tree: Root downward"))
            record(f"tree-{cycle}", True)
        session.close_panel("layouts")
        session.wait("return !document.querySelector('[data-editor-panel=layouts]')")
        record("tree-restored", True)
        session.refresh()
        session.wait("return document.querySelectorAll('button.ge-select-node-hitbox').length===7")
        record("tree-reloaded", True)
        results.append({"scenario": "issue-45-edge-routing", "variant": variant, "snapshots": snapshots})
    (OUTPUT / "issue-45-results.json").write_text(json.dumps({"status": "failed" if failures else "passed", "results": results, "failures": failures}, indent=2))
    assert not failures, "Issue #45 edge routing regression: " + json.dumps(failures)
    return results


RANGE_CY = """
const container = [...document.querySelectorAll('div')].find(e => '_cyreg' in e);
if (!container) throw new Error('Cytoscape container missing');
const cy = container._cyreg.cy;
"""

RANGE_FIXTURE = {
    "version": 1,
    "settings": {"directed": False, "weighted": False, "indexBase": 0,
                 "allowSelfLoops": True, "allowMultiEdges": True,
                 "autoEdgeRouting": False, "snapToGrid": False,
                 "showNodeLabels": True, "arrowScale": 1, "weightKind": "number"},
    "nodes": [
        {"id": "a", "label": "A", "order": 0, "x": -160, "y": -90},
        {"id": "b", "label": "B", "order": 1, "x": 20, "y": -90},
        {"id": "c", "label": "C", "order": 2, "x": -160, "y": 90},
        {"id": "d", "label": "D", "order": 3, "x": 260, "y": 180},
    ],
    "edges": [
        {"id": "ab", "source": "a", "target": "b", "label": "AB"},
        {"id": "ac", "source": "a", "target": "c", "label": "AC"},
        {"id": "cd", "source": "c", "target": "d", "label": "CD"},
    ],
}

RANGE_KEYS = {"shift": "\ue008", "ctrl": "\ue009", "alt": "\ue00a", "meta": "\ue03d"}


def range_snapshot(session):
    return session.js(RANGE_CY + """
return {
    nodes: cy.nodes(':selected').map(e => e.id()).sort(),
    edges: cy.edges(':selected').map(e => e.id()).sort(),
    previewNodes: cy.nodes('.range-preview').map(e => e.id()).sort(),
    previewEdges: cy.edges('.range-preview').map(e => e.id()).sort(),
    pressedNodes: [...document.querySelectorAll('.ge-select-node-hitbox')].map(e => e.getAttribute('aria-pressed') === 'true'),
    pressedEdges: [...document.querySelectorAll('.ge-select-edge-hitbox')].map(e => e.getAttribute('aria-pressed') === 'true'),
    summary: document.querySelector('.ge-selection-summary')?.textContent.trim() ?? '',
    menuVisible: !!document.querySelector('[data-range-selection-controls]'),
    triggerExpanded: document.querySelector('[data-range-selection-trigger]')?.getAttribute('aria-expanded'),
    triggerFocused: document.activeElement?.matches('[data-range-selection-trigger]') ?? false,
    items: [...document.querySelectorAll('[data-range-selection-controls] [role=menuitemradio]')].map(e => ({
        label: e.textContent.trim() || e.getAttribute('aria-label'),
        checked: e.getAttribute('aria-checked') === 'true', tabIndex: e.tabIndex,
        focused: e === document.activeElement,
    })),
};
""")


def range_key(session, value):
    session.command("POST", "/actions", {"actions": [{"type": "key", "id": "keyboard", "actions": [
        {"type": "keyDown", "value": value}, {"type": "keyUp", "value": value}]}]})


def choose_range_target(session, label):
    open_range_menu(session)
    element = session.js("""return [...document.querySelectorAll('[data-range-selection-controls] [role=menuitemradio]')]
        .find(e => e.getAttribute('aria-label') === arguments[0] || e.textContent.trim() === arguments[0]);""", label)
    assert element, f"Range target menu item missing: {label}"
    session.activate(element[ELEMENT])
    session.wait("return !document.querySelector('[data-range-selection-controls]')")
    assert_range_menu_closed(session, restore_focus=True)
    inspect_range_target(session, label)


def assert_range_menu_closed(session, restore_focus=False):
    snapshot = range_snapshot(session)
    assert not snapshot["menuVisible"] and not snapshot["items"], snapshot
    assert snapshot["triggerExpanded"] == "false", snapshot
    if restore_focus:
        assert snapshot["triggerFocused"], snapshot


def open_range_menu(session):
    assert_range_menu_closed(session)
    session.focus_window()
    trigger = session.element("[data-range-selection-trigger]")
    assert session.command("GET", f"/element/{trigger}/attribute/aria-haspopup") == "menu"
    session.activate(trigger)
    session.wait("return !!document.querySelector('[data-range-selection-controls][role=menu]')")


def assert_range_menu(session, checked_label, focused_label=None):
    snapshot = range_snapshot(session)
    items = snapshot["items"]
    checked = [item for item in items if item["checked"]]
    assert snapshot["menuVisible"] and snapshot["triggerExpanded"] == "true", snapshot
    assert len(items) == 3 and len(checked) == 1 and checked[0]["label"] == checked_label, items
    if focused_label is not None:
        assert [item["label"] for item in items if item["focused"]] == [focused_label], items


def inspect_range_target(session, label):
    open_range_menu(session)
    assert_range_menu(session, label)
    range_key(session, "\ue00c")
    session.wait("return !document.querySelector('[data-range-selection-controls]')")
    assert_range_menu_closed(session, restore_focus=True)


def range_drag(session, points, keys, expected_nodes, expected_edges, summary,
               name, release_before_up=False):
    assert_range_menu_closed(session)
    session.focus_window()
    session.js("""window.__rangePointerEvents=[];
        for(const type of ['pointerdown','pointermove','pointerup','pointercancel','mousedown','mouseup','blur'])window.addEventListener(type,e=>{
            window.__rangePointerEvents.push({type,x:e.clientX,y:e.clientY,buttons:e.buttons,ctrl:e.ctrlKey,meta:e.metaKey,shift:e.shiftKey,target:e.target===window?'window':e.target.tagName});
            window.__rangePointerEvents=window.__rangePointerEvents.slice(-40);
        },true);""")
    # Separate actions let us inspect the actual drag preview before release.
    session.command("POST", "/actions", {"actions": [{"type": "key", "id": "keyboard", "actions": [
        {"type": "keyDown", "value": RANGE_KEYS[key]} for key in keys]}]})
    session.command("POST", "/actions", {"actions": [{"type": "pointer", "id": "mouse", "parameters": {"pointerType": "mouse"}, "actions": [
        {"type": "pointerMove", "duration": 0, "origin": "viewport", "x": round(points[0]["x"]), "y": round(points[0]["y"])},
        {"type": "pointerDown", "button": 0},
        {"type": "pointerMove", "duration": 400, "origin": "viewport", "x": round(points[1]["x"]), "y": round(points[1]["y"])},
    ]}]})
    try:
        session.wait(RANGE_CY + "return cy.nodes('.range-preview').map(e=>e.id()).sort().join(',') === " + json.dumps(",".join(expected_nodes)) +
                     " && cy.edges('.range-preview').map(e=>e.id()).sort().join(',') === " + json.dumps(",".join(expected_edges)))
    except AssertionError as error:
        snapshot = session.js(RANGE_CY + "return {events:window.__rangePointerEvents,pan:cy.pan(),zoom:cy.zoom(),focused:document.hasFocus(),previewNodes:cy.nodes('.range-preview').map(e=>e.id()),previewEdges:cy.edges('.range-preview').map(e=>e.id())};")
        raise AssertionError("Native range drag failed: " + json.dumps({"name": name, "points": points, **snapshot})) from error
    preview = range_snapshot(session)
    assert preview["previewNodes"] == expected_nodes and preview["previewEdges"] == expected_edges, (name, preview)
    if release_before_up:
        session.command("POST", "/actions", {"actions": [{"type": "key", "id": "keyboard", "actions": [
            {"type": "keyUp", "value": RANGE_KEYS[key]} for key in reversed(keys)]}]})
    session.command("POST", "/actions", {"actions": [{"type": "pointer", "id": "mouse", "parameters": {"pointerType": "mouse"}, "actions": [
        {"type": "pointerUp", "button": 0}]}]})
    if not release_before_up:
        # Safari's release-actions endpoint can retain stale modifier flags.
        # Send real keyUp events before clearing the remaining action sources.
        session.command("POST", "/actions", {"actions": [{"type": "key", "id": "keyboard", "actions": [
            {"type": "keyUp", "value": RANGE_KEYS[key]} for key in reversed(keys)]}]})
    session.command("DELETE", "/actions")
    modifier_recovery = False
    if len(keys) > 1 and session.js("const e=window.__rangeEvents?.at(-1);return !!e&&(e.ctrl||e.meta||e.shift);"):
        # SafariDriver can clear its action source while leaving native modifier
        # flags set after a chord. Press/release each key as a separate action
        # to restore the isolated driver's native state, without changing DOM.
        for key in ("alt", "shift", "ctrl", "meta"):
            session.command("POST", "/actions", {"actions": [{"type": "key", "id": "keyboard", "actions": [
                {"type": "keyDown", "value": RANGE_KEYS[key]},
                {"type": "keyUp", "value": RANGE_KEYS[key]}]}]})
        session.command("DELETE", "/actions")
        modifier_recovery = True
    session.wait(RANGE_CY + "return cy.nodes(':selected').map(e=>e.id()).sort().join(',') === " + json.dumps(",".join(expected_nodes)) +
                 " && cy.edges(':selected').map(e=>e.id()).sort().join(',') === " + json.dumps(",".join(expected_edges)) +
                 " && document.querySelector('.ge-selection-summary')?.textContent.trim() === " + json.dumps(summary))
    committed = range_snapshot(session)
    assert committed["nodes"] == expected_nodes and committed["edges"] == expected_edges, (name, committed)
    assert not committed["previewNodes"] and not committed["previewEdges"], (name, committed)
    assert committed["pressedNodes"] == [n["id"] in expected_nodes for n in RANGE_FIXTURE["nodes"]], (name, committed)
    assert committed["pressedEdges"] == [e["id"] in expected_edges for e in RANGE_FIXTURE["edges"]], (name, committed)
    assert committed["summary"] == summary, (name, committed)
    assert_range_menu_closed(session)
    print(f"{name}: preview, selected IDs and visible selection passed", flush=True)
    return {"name": name, "keys": list(keys), "releaseModifiersBeforePointerUp": release_before_up,
            "nativeModifierRecovery": modifier_recovery,
            "nodes": committed["nodes"], "edges": committed["edges"], "summary": committed["summary"]}


def run_range_selection(session):
    messages = {
        "ja": {"path": "/", "group": "範囲選択の対象", "targets": ["すべて", "頂点だけ", "辺だけ"],
               "select": "選択", "node": "頂点", "mixed": "3 頂点 · 2 辺", "nodes": "3 頂点", "edges": "2 辺"},
        "en": {"path": "/en", "group": "Box selection target", "targets": ["All", "Nodes only", "Edges only"],
               "select": "Select", "node": "Node", "mixed": "3 nodes · 2 edges", "nodes": "3 nodes", "edges": "2 edges"},
        "zh-hans": {"path": "/zh-hans", "group": "框选对象", "targets": ["全部", "仅顶点", "仅边"],
                    "select": "选择", "node": "顶点", "mixed": "3 个顶点 · 2 条边", "nodes": "3 个顶点", "edges": "2 条边"},
    }
    results = []
    cases = [("en", 600)] + [(locale, 1440) for locale in messages]
    for index, (locale, width) in enumerate(cases):
        if index:
            session.restart()
        m = messages[locale]
        session.command("POST", "/window/rect", {"width": width, "height": 1000}, check=False)
        session.navigate(m["path"])
        # Only the isolated WebDriver session's local application data is reset.
        session.js("localStorage.clear(); localStorage.setItem('graph-editor-graph', arguments[0]);", json.dumps(RANGE_FIXTURE))
        session.refresh()
        session.wait("return !!document.querySelector('[data-canvas-ready=true]') && document.querySelectorAll('.ge-select-node-hitbox').length === 4 && !!document.querySelector('[data-range-selection-trigger]')")
        session.js("""window.__rangeEvents=[]; for(const type of ['keydown','keyup']) window.addEventListener(type,e=>window.__rangeEvents.push({type,key:e.key,ctrl:e.ctrlKey,meta:e.metaKey,shift:e.shiftKey}));""")
        assert_range_menu_closed(session)
        geometry = session.js(RANGE_CY + """
cy.zoom(1); cy.pan({x: container.clientWidth / 2, y: 400});
const rect = container.getBoundingClientRect();
const point = (p) => ({x: p.x + rect.left, y: p.y + rect.top});
const a = cy.getElementById('a').renderedPosition();
const b = cy.getElementById('b').renderedPosition();
const c = cy.getElementById('c').renderedPosition();
return {viewport: {width: innerWidth, height: innerHeight},
    background: [point({x: a.x - 60, y: a.y - 60}), point({x: b.x + 60, y: c.y + 60})],
    nodeStart: [point(cy.getElementById('d').renderedPosition()), point({x: a.x - 60, y: a.y - 60})],
    edgeStart: [point(cy.getElementById('cd').renderedMidpoint()), point({x: a.x - 60, y: a.y - 60})]};
""")
        session.wait("return [...document.querySelectorAll('.ge-select-node-hitbox')].every(e => e.getBoundingClientRect().width > 0)")
        prefix = f"safari-range-{locale}-{width}"
        all_label, nodes_label, edges_label = m["targets"]
        session.screenshot(prefix + "-default")
        inspect_range_target(session, all_label)
        checks = [range_drag(session, geometry["background"], ["ctrl"], ["a", "b", "c"], ["ab", "ac"], m["mixed"], prefix + "-default-all")]
        trigger = session.element("[data-range-selection-trigger]")
        session.js("arguments[0].focus()", {ELEMENT: trigger})
        range_key(session, "\ue015")
        session.wait("return !!document.querySelector('[data-range-selection-controls]')")
        assert_range_menu(session, all_label, focused_label=all_label)
        # Menu arrows move focus; only Enter commits a target.
        for key, target in [("\ue015", nodes_label), ("\ue015", edges_label), ("\ue011", all_label),
                            ("\ue010", edges_label), ("\ue013", nodes_label)]:
            range_key(session, key)
            assert_range_menu(session, all_label, focused_label=target)
        range_key(session, "\ue007")
        session.wait("return !document.querySelector('[data-range-selection-controls]')")
        assert_range_menu_closed(session, restore_focus=True)
        inspect_range_target(session, nodes_label)
        open_range_menu(session)
        assert_range_menu(session, nodes_label, focused_label=nodes_label)
        session.command("POST", "/actions", {"actions": [{"type": "key", "id": "keyboard", "actions": [
            {"type": "keyDown", "value": RANGE_KEYS["shift"]},
            {"type": "keyDown", "value": "\ue004"}, {"type": "keyUp", "value": "\ue004"},
            {"type": "keyUp", "value": RANGE_KEYS["shift"]}]}]})
        session.wait("return !document.querySelector('[data-range-selection-controls]')")
        assert_range_menu_closed(session)
        assert session.js("return !document.activeElement.closest('[role=menu]')"), "Shift+Tab leaves the menu"
        inspect_range_target(session, nodes_label)
        choose_range_target(session, edges_label)
        open_range_menu(session)
        assert_range_menu(session, edges_label)
        session.command("POST", "/actions", {"actions": [{"type": "pointer", "id": "mouse", "parameters": {"pointerType": "mouse"}, "actions": [
            {"type": "pointerMove", "duration": 0, "origin": "viewport", "x": round(geometry["background"][0]["x"]), "y": round(geometry["background"][0]["y"])},
            {"type": "pointerDown", "button": 0}, {"type": "pointerUp", "button": 0}]}]})
        session.command("DELETE", "/actions")
        session.wait("return !document.querySelector('[data-range-selection-controls]')")
        assert_range_menu_closed(session)
        inspect_range_target(session, edges_label)
        checks.append(range_drag(session, geometry["background"], ["shift"], [], ["ab", "ac"], m["edges"], prefix + "-edges-shift"))
        session.screenshot(prefix + "-edges")
        choose_range_target(session, nodes_label)
        checks.append(range_drag(session, geometry["background"], ["ctrl"], ["a", "b", "c"], [], m["nodes"], prefix + "-nodes-ctrl"))
        checks.append(range_drag(session, geometry["background"], ["meta"], ["a", "b", "c"], [], m["nodes"], prefix + "-nodes-meta", release_before_up=True))
        session.screenshot(prefix + "-nodes")
        checks.append(range_drag(session, geometry["nodeStart"], ["ctrl"], ["a", "b", "c"], [], m["nodes"], prefix + "-node-start"))
        checks.append(range_drag(session, geometry["background"], ["ctrl", "alt"], [], ["ab", "ac"], m["edges"], prefix + "-edge-shortcut-override"))
        inspect_range_target(session, nodes_label)
        choose_range_target(session, edges_label)
        checks.append(range_drag(session, geometry["background"], ["meta", "shift"], ["a", "b", "c"], [], m["nodes"], prefix + "-node-shortcut-override"))
        inspect_range_target(session, edges_label)
        checks.append(range_drag(session, geometry["edgeStart"], ["ctrl"], [], ["ab", "ac"], m["edges"], prefix + "-edge-start"))
        session.activate(session.button(m["node"]))
        assert_range_menu_closed(session)
        session.activate(session.button(m["select"]))
        session.wait("return document.querySelectorAll('.ge-select-node-hitbox').length === 4 && !document.querySelector('.ge-select-node-hitbox')?.closest('[inert]')")
        inspect_range_target(session, edges_label)
        choose_range_target(session, all_label)
        checks.append(range_drag(session, geometry["background"], ["shift"], ["a", "b", "c"], ["ab", "ac"], m["mixed"], prefix + "-reset-all"))
        inspect_range_target(session, all_label)
        open_range_menu(session)
        assert_range_menu(session, all_label)
        assert session.js("return document.querySelector('[data-range-selection-controls]')?.getAttribute('aria-label')") == m["group"]
        controls = session.js("""const e = document.querySelector('[data-range-selection-controls]'); const r = e.getBoundingClientRect();
return {x: r.x, y: r.y, width: r.width, height: r.height, viewportWidth: innerWidth, viewportHeight: innerHeight,
    items: [...e.querySelectorAll('[role=menuitemradio]')].map(e => ({label: e.textContent.trim(), x: e.getBoundingClientRect().x, right: e.getBoundingClientRect().right}))};""")
        assert controls["x"] >= 0 and controls["x"] + controls["width"] <= controls["viewportWidth"] + 1, controls
        assert controls["y"] >= 0 and controls["y"] + controls["height"] <= controls["viewportHeight"] + 1, controls
        assert all(item["x"] >= 0 and item["right"] <= controls["viewportWidth"] + 1 for item in controls["items"]), controls
        session.screenshot(prefix + "-menu")
        range_key(session, "\ue00c")
        session.wait("return !document.querySelector('[data-range-selection-controls]')")
        assert_range_menu_closed(session, restore_focus=True)
        session.screenshot(prefix + "-reset")
        results.append({"locale": locale, "requestedWindowWidth": width, "viewport": geometry["viewport"], "controls": controls,
                        "checks": checks, "keyboardMenuNavigation": "passed", "menuHiddenBetweenDrags": "passed",
                        "escapeAndOutsideDismiss": "passed", "shiftTabDismiss": "passed", "toolSwitchRetainsTarget": "passed"})
        print(f"{prefix}: all range-selection checks passed", flush=True)
    return results


def run_range_menu_review(session):
    results = []
    for index, (locale, path, width) in enumerate((("ja", "/", 896), ("en", "/en", 600), ("zh-hans", "/zh-hans", 960))):
        if index:
            session.restart()
        session.command("POST", "/window/rect", {"width": width, "height": 984}, check=False)
        session.navigate(path)
        session.js("localStorage.clear();localStorage.setItem('graph-editor-graph',arguments[0]);localStorage.setItem('graph-editor-theme','light');", json.dumps(RANGE_FIXTURE))
        session.refresh()
        session.wait("return !!document.querySelector('[data-canvas-ready=true]') && !!document.querySelector('[data-range-selection-trigger]')", timeout=30)
        session.focus_window()
        time.sleep(0.2)
        session.command("DELETE", "/actions")
        trigger = session.element("[data-range-selection-trigger]")
        session.wait("return !!document.querySelector('.ge-tooltip')")
        session.js("""window.__safariHoverEvents=[];
            for(const type of ['pointerover','pointerout']) document.addEventListener(type,e=>{
                window.__safariHoverEvents.push({type,pointerType:e.pointerType,x:e.clientX,y:e.clientY,time:performance.now(),
                    label:e.target.closest?.('[data-tooltip]')?.dataset.tooltip});
                window.__safariHoverEvents=window.__safariHoverEvents.slice(-12);
            },true);
            for(const type of ['blur','scroll']) window.addEventListener(type,e=>{
                if(type==='blur'&&e.target!==window)return;
                window.__safariHoverEvents.push({type,target:e.target===window?'window':e.target.tagName,time:performance.now()});
                window.__safariHoverEvents=window.__safariHoverEvents.slice(-12);
            },true);
            """)

        def hover(element):
            session.js("window.__safariHoverStarted=performance.now();")
            session.command("POST", "/actions", {"actions": [{"type": "pointer", "id": "mouse", "parameters": {"pointerType": "mouse"}, "actions": [
                # Escape dismisses a tooltip until a fresh pointer entry.
                {"type": "pointerMove", "duration": 150, "origin": "viewport", "x": 1, "y": 300},
                {"type": "pause", "duration": 100},
                {"type": "pointerMove", "duration": 150, "origin": {ELEMENT: element}, "x": 0, "y": 0}]}]})
            time.sleep(0.6)

        hover_retries = 0
        def wait_tooltip():
            nonlocal hover_retries
            condition = "const t=document.querySelector('[data-range-selection-trigger]');return window.__safariHoverEvents.some(e=>e.type==='pointerover'&&e.time>=window.__safariHoverStarted&&e.label===t.dataset.tooltip)&&[...document.querySelectorAll('.ge-tooltip')].some(e=>!e.hidden&&e.textContent===t.dataset.tooltip)"
            try:
                try:
                    session.wait(condition, timeout=3)
                except AssertionError:
                    interrupted = session.js("return window.__safariHoverEvents.some(e=>e.type==='blur'&&e.time>=window.__safariHoverStarted)")
                    if not interrupted:
                        raise
                    # Blur correctly dismisses a tooltip. Repeat only this
                    # read-only pointer entry after Safari's window transition.
                    hover_retries += 1
                    hover(trigger)
                    session.wait(condition, timeout=3)
            except AssertionError as error:
                snapshot = session.js("""const t=document.querySelector('[data-range-selection-trigger]');const r=t.getBoundingClientRect();
                    return {focused:document.hasFocus(),hover:matchMedia('(hover:hover)').matches,
                        viewport:visualViewport&&{left:visualViewport.offsetLeft,top:visualViewport.offsetTop,width:visualViewport.width,height:visualViewport.height},
                        trigger:t.dataset.tooltip,expanded:t.getAttribute('aria-expanded'),rect:{x:r.x,y:r.y,width:r.width,height:r.height},
                        tooltips:[...document.querySelectorAll('.ge-tooltip')].map(e=>({hidden:e.hidden,text:e.textContent})),
                        events:window.__safariHoverEvents};""")
                raise AssertionError("Native tooltip activation failed: " + json.dumps(snapshot)) from error

        hover(trigger)
        wait_tooltip()
        session.activate(trigger)
        session.wait("return !!document.querySelector('[data-range-selection-controls]')")
        toolbar = session.js("return document.querySelector('[data-range-selection-trigger]').closest('[role=toolbar]')")
        neighbor = session.js("return arguments[0].querySelector('[data-tooltip]:not([data-range-selection-trigger])')", toolbar)
        hover(neighbor[ELEMENT] if neighbor else trigger)
        layout = session.js("""const menu=document.querySelector('[data-range-selection-controls]');
if(!menu)return {menuMissing:true,focused:document.hasFocus(),events:window.__safariHoverEvents};
const footer=menu.lastElementChild;
const text=document.createRange();text.selectNodeContents(footer);const rect=menu.getBoundingClientRect();
return {hint:footer.textContent,lines:text.getClientRects().length,footerWidth:footer.clientWidth,textWidth:footer.scrollWidth,
    x:rect.x,y:rect.y,right:rect.right,bottom:rect.bottom,viewportWidth:innerWidth,viewportHeight:innerHeight,
    tooltipsHidden:[...document.querySelectorAll('.ge-tooltip')].every(e=>e.hidden)};""")
        assert not layout.get("menuMissing"), layout
        assert layout["lines"] == 1 and layout["textWidth"] <= layout["footerWidth"] + 1, layout
        assert layout["tooltipsHidden"], layout
        assert layout["x"] >= 0 and layout["right"] <= layout["viewportWidth"] + 1, layout
        assert layout["y"] >= 0 and layout["bottom"] <= layout["viewportHeight"] + 1, layout
        session.screenshot(f"safari-range-menu-{locale}-{width}")
        range_key(session, "\ue00c")
        session.wait("return !document.querySelector('[data-range-selection-controls]')")
        # Escape dismisses the current activation. Leave focus before testing
        # a new hover activation, rather than reusing that dismissed trigger.
        assert neighbor, "The toolbar supplies a separate focus target"
        session.js("arguments[0].focus();", neighbor)
        session.wait("return document.activeElement!==document.querySelector('[data-range-selection-trigger]')")
        hover(trigger)
        wait_tooltip()
        tooltip = session.element('.ge-tooltip:not([hidden])')
        tooltip_id = session.js("return arguments[0].id", {ELEMENT: tooltip})
        session.command("POST", "/actions", {"actions": [{"type": "pointer", "id": "mouse", "parameters": {"pointerType": "mouse"}, "actions": [
            {"type": "pointerMove", "duration": 100, "origin": {ELEMENT: tooltip}, "x": 0, "y": 0},
            {"type": "pause", "duration": 400}]}]})
        session.wait("const t=document.querySelector('[data-range-selection-trigger]'),tip=document.getElementById(" + json.dumps(tooltip_id) + ");return tip&&!tip.hidden&&tip.textContent===t.dataset.tooltip&&(t.getAttribute('aria-describedby')||'').split(/\\s+/).includes(tip.id)")
        session.screenshot(f"safari-tooltip-hover-{locale}-{width}")
        range_key(session, "\ue00c")
        session.wait("const t=document.querySelector('[data-range-selection-trigger]');return [...document.querySelectorAll('.ge-tooltip')].every(e=>e.hidden)&&!(t.getAttribute('aria-describedby')||'').split(/\\s+/).includes(" + json.dumps(tooltip_id) + ")")
        session.command("DELETE", "/actions")
        results.append({"locale": locale, "requestedWindowWidth": width, **layout, "closedTooltipRestored": True,
                        "tooltipHoverRetained": True, "tooltipEscapeAndDescriptionCleanup": True,
                        "windowBlurHoverRetries": hover_retries})
        print(f"safari-range-menu-{locale}-{width}: single-line hint and tooltip open/close passed", flush=True)
    return results



def run_self_loop_review(session):
    """Issue #3: toggle automatic routing and reload."""
    results = []
    for count in (2, 3, 10):
        session.navigate("/en")
        fixture = {**RANGE_FIXTURE,
                   "settings": {**RANGE_FIXTURE["settings"], "autoEdgeRouting": False},
                   "nodes": [{"id": "a", "label": "0", "order": 0, "x": 0, "y": 0}],
                   "edges": [{"id": f"loop-{i}", "source": "a", "target": "a"} for i in range(count)]}
        session.js("localStorage.clear(); localStorage.setItem('graph-editor-graph',arguments[0]); localStorage.setItem('graph-editor-theme','light');", json.dumps(fixture))
        session.refresh()
        session.wait("return !!document.querySelector('[data-canvas-ready=true]')")
        session.wait(RANGE_CY + f"return cy.edges().length==={count};")
        if session.command("GET", f"/element/{session.button('Layout')}/attribute/aria-expanded") != "true":
            session.activate(session.button("Layout"))
        session.wait("return !!document.querySelector('[data-editor-panel=layouts]')")
        session.activate(session.button("Offset overlapping edges"))
        session.activate(session.button("Layout"))
        def snapshot():
            return session.js(RANGE_CY + "return cy.edges().map(e=>({id:e.id(),direction:parseFloat(e.data('loopDirection')),sweep:parseFloat(e.data('loopSweep')),points:e.controlPoints()}));")
        session.wait(RANGE_CY + f"return cy.edges().length==={count} && Math.abs(parseFloat(cy.edges()[1].data('loopDirection'))-parseFloat(cy.edges()[0].data('loopDirection')))>{360/count-1};")
        before = snapshot()
        assert all(edge["sweep"] < 360/count for edge in before), before
        session.screenshot(f"self-loops-{count}")
        session.refresh()
        session.wait("return !!document.querySelector('[data-canvas-ready=true]')")
        restored = snapshot()
        assert [e["direction"] for e in before] == [e["direction"] for e in restored]
        results.append({"count": count, "before": before, "restored": restored})
        print(f"Self-loops {count}: toggle and reload passed", flush=True)
    (OUTPUT / "self-loop-results.json").write_text(json.dumps(results, indent=2))
    return results


def run_text_weight_review(session):
    session.navigate("/en")
    session.js("localStorage.clear();")
    session.refresh()
    session.wait("return !!document.querySelector('[data-canvas-ready=true]')")
    session.open_panel("Load a graph", "starter")
    textarea = session.element("textarea")
    session.command("POST", f"/element/{textarea}/value", {"text": "3 2\n1 2 INF\n2 3 ∞"})
    session.wait("return [...document.querySelectorAll('button')].some(e=>e.textContent.trim()==='Apply to graph'&&!e.disabled)")
    session.activate(session.button("Apply to graph"))
    session.wait("return JSON.parse(localStorage.getItem('graph-editor-graph')||'null')?.edges[0]?.weight==='INF'")
    session.click(session.element(".ge-select-edge-hitbox"))
    range_key(session, "\ue007")
    editor = session.element('input[name="graph-edge-weight"]')
    assert session.js("return document.querySelector('input[name=graph-edge-weight]').inputMode") == "text"
    session.command("POST", f"/element/{editor}/clear", {})
    session.command("POST", f"/element/{editor}/value", {"text": "容量 ∞"})
    range_key(session, "\ue007")
    session.wait("return !document.querySelector('input[name=graph-edge-weight]') && JSON.parse(localStorage.getItem('graph-editor-graph')).edges[0].weight==='容量 ∞'")
    session.screenshot("text-weight-edited")
    session.refresh()
    session.wait("return !!document.querySelector('[data-canvas-ready=true]')")
    weights = session.js("const cy=[...document.querySelectorAll('div')].find(e=>'_cyreg' in e)?._cyreg?.cy;return cy?.edges().map(e=>e.data('weight'));")
    assert weights == ["容量 ∞", "∞"], weights
    (OUTPUT / "text-weight-review.json").write_text(json.dumps({"status": "passed", "weights": weights}, ensure_ascii=False, indent=2))
    print("Safari text weights: import, keyboard edit, text input mode, canvas and reload passed", flush=True)


def run_multi_selection_review(session):
    """Issue #23: native additive selection must survive group editing."""
    results = []
    selected_ids = ["a", "b"]
    for variant in ("ctrl", "meta", "range"):
        if results:
            session.restart()
        session.command("POST", "/window/rect", {"width": 1440, "height": 1000}, check=False)
        session.navigate("/en")
        session.verify_storage()
        # Start a new document after clearing storage; replacing an identical
        # live model would be a no-op and would not establish persistence.
        session.wait("return !!document.querySelector('[data-canvas-ready=true]')")
        session.js("localStorage.clear();localStorage.setItem('graph-editor-theme','light');")
        session.wait("return localStorage.getItem('graph-editor-graph')===null")
        session.refresh()
        session.wait("return !!document.querySelector('[data-canvas-ready=true]')")
        session.wait(RANGE_CY + "return cy.nodes().length===0&&cy.edges().length===0&&localStorage.getItem('graph-editor-graph')===null&&!!document.querySelector('[data-editor-empty-state]');")
        session.js(RANGE_CY + """
            window.__multiStorageEvents=[];window.__multiStorageErrors=[];
            window.__multiStorageBefore={saved:localStorage.getItem('graph-editor-graph'),liveNodes:cy.nodes().map(n=>n.id()),liveEdges:cy.edges().map(e=>e.id()),url:location.href};
            window.addEventListener('graph-editor:storage-state',()=>window.__multiStorageEvents.push({time:performance.now(),saved:localStorage.getItem('graph-editor-graph'),notice:document.querySelector('[data-storage-notice]')?.dataset.storageNotice??null}));
            window.addEventListener('error',e=>window.__multiStorageErrors.push({type:'error',message:e.message,file:e.filename,line:e.lineno}));
            window.addEventListener('unhandledrejection',e=>window.__multiStorageErrors.push({type:'rejection',message:String(e.reason)}));
        """)
        (OUTPUT / f"multi-selection-{variant}-before.json").write_text(json.dumps(session.js("return window.__multiStorageBefore"), indent=2))
        session.open_panel("Load a graph", "starter")
        textarea = session.element('[data-editor-panel=starter] textarea')
        session.command("POST", f"/element/{textarea}/value", {"text": json.dumps(RANGE_FIXTURE)})
        session.wait("return [...document.querySelectorAll('[data-editor-panel=starter] button')].some(e=>e.textContent.trim()==='Apply to graph'&&!e.disabled)")
        try:
            session.activate(session.button("Apply to graph"))
            session.wait("return !!document.querySelector('[data-canvas-ready=true]') && document.querySelectorAll('.ge-select-node-hitbox').length === 4")
            session.focus_window()
            session.wait("return JSON.parse(localStorage.getItem('graph-editor-graph')||'null')?.nodes.map(n=>n.id).join(',')==='a,b,c,d'")
        finally:
            diagnostic = session.js(RANGE_CY + "return {variant:arguments[0],before:window.__multiStorageBefore,saved:localStorage.getItem('graph-editor-graph'),liveNodes:cy.nodes().map(n=>({id:n.id(),label:n.data('displayLabel')})),storageEvents:window.__multiStorageEvents,errors:window.__multiStorageErrors,notice:document.querySelector('[data-storage-notice]')?.dataset.storageNotice??null,locks:!!navigator.locks,visibility:document.visibilityState,focused:document.hasFocus(),url:location.href};", variant)
            (OUTPUT / "multi-selection-fixture.json").write_text(json.dumps(diagnostic, indent=2))
            (OUTPUT / f"multi-selection-{variant}-fixture.json").write_text(json.dumps(diagnostic, indent=2))
        session.js(RANGE_CY + "cy.zoom(1); cy.pan({x:container.clientWidth/2,y:400});")
        session.js("window.__multiKeys=[];for(const type of ['keydown','keyup'])window.addEventListener(type,e=>window.__multiKeys.push({type,key:e.key,shift:e.shiftKey,ctrl:e.ctrlKey,meta:e.metaKey,target:e.target.tagName,prevented:e.defaultPrevented}),true);")
        baseline = session.js("return JSON.parse(localStorage.getItem('graph-editor-graph'))")
        stages = []
        current_stage = "load"

        def snapshot():
            return session.js(RANGE_CY + """return {
                saved: JSON.parse(localStorage.getItem('graph-editor-graph')),
                liveNodes: cy.nodes().map(e=>({id:e.id(),x:e.position('x'),y:e.position('y'),fill:e.style('background-color')})),
                selectedNodes: cy.nodes(':selected').map(e=>e.id()).sort(),
                selectedEdges: cy.edges(':selected').map(e=>e.id()).sort(),
                pressedNodes: [...document.querySelectorAll('.ge-select-node-hitbox')].map(e=>({label:e.getAttribute('aria-label'),pressed:e.getAttribute('aria-pressed')==='true'})),
                summary: document.querySelector('.ge-selection-summary')?.textContent.trim() ?? '',
                inlineEditors: [...document.querySelectorAll('.ge-inline-edit-input')].map(e=>e.value),
                activeElement: {tag:document.activeElement.tagName,label:document.activeElement.getAttribute('aria-label')},
                keyEvents: window.__multiKeys,
                paletteClick: window.__multiPaletteClick ?? null,
                paletteEvents: window.__multiPaletteEvents ?? []
            };""")

        def verify(stage, expected, ids=selected_ids):
            nonlocal current_stage
            current_stage = stage
            projection = [[n["id"], n["x"], n["y"], n.get("color", "paper")] for n in expected["nodes"]]
            summary = "2 nodes" if ids == selected_ids else "Node A"
            session.wait(RANGE_CY + """const saved=JSON.parse(localStorage.getItem('graph-editor-graph'));
                const actual=saved?.nodes.map(n=>[n.id,n.x,n.y,n.color??'paper']);
                const pressed=[...document.querySelectorAll('.ge-select-node-hitbox')].map((e,i)=>e.getAttribute('aria-pressed')==='true');
                return JSON.stringify(actual)===JSON.stringify(""" + json.dumps(projection) + ") && " +
                "cy.nodes(':selected').map(e=>e.id()).sort().join(',')===" + json.dumps(",".join(ids)) +
                " && cy.edges(':selected').length===0 && JSON.stringify(pressed)===JSON.stringify(" +
                json.dumps([n["id"] in ids for n in expected["nodes"]]) + ") && " +
                "document.querySelector('.ge-selection-summary')?.textContent.trim()===" + json.dumps(summary))
            actual = snapshot()
            assert actual["saved"] == expected, (variant, stage, actual)
            assert actual["selectedNodes"] == ids and not actual["selectedEdges"], (variant, stage, actual)
            assert not actual["inlineEditors"], (variant, stage, actual)
            assert [(n["id"], n["x"], n["y"]) for n in actual["liveNodes"]] == [(n["id"], n["x"], n["y"]) for n in expected["nodes"]], (variant, stage, actual)
            stages.append({"stage": stage, **actual})
            (OUTPUT / f"multi-selection-{variant}-{stage}.json").write_text(json.dumps(actual, indent=2))
            print(f"multi-selection-{variant}-{stage}: saved graph, live positions and selection agree", flush=True)
            return actual

        def point(node_id):
            return session.js(RANGE_CY + "const p=cy.getElementById(arguments[0]).renderedPosition();const r=container.getBoundingClientRect();return {x:p.x+r.x,y:p.y+r.y};", node_id)

        def native_click(node_id, modifier=None):
            p = point(node_id)
            if modifier:
                session.command("POST", "/actions", {"actions": [{"type": "key", "id": "keyboard", "actions": [
                    {"type": "keyDown", "value": RANGE_KEYS[modifier]}]}]})
            session.command("POST", "/actions", {"actions": [{"type": "pointer", "id": "mouse", "parameters": {"pointerType": "mouse"}, "actions": [
                {"type": "pointerMove", "duration": 0, "origin": "viewport", "x": round(p["x"]), "y": round(p["y"])},
                {"type": "pointerDown", "button": 0}, {"type": "pointerUp", "button": 0}]}]})
            if modifier:
                session.command("POST", "/actions", {"actions": [{"type": "key", "id": "keyboard", "actions": [
                    {"type": "keyUp", "value": RANGE_KEYS[modifier]}]}]})
            session.command("DELETE", "/actions")

        def moved(graph, dx, dy):
            result = json.loads(json.dumps(graph))
            for node in result["nodes"]:
                if node["id"] in selected_ids:
                    node["x"] += dx
                    node["y"] += dy
            return result

        try:
            if variant == "range":
                choose_range_target(session, "Nodes only")
                a, b = point("a"), point("b")
                range_drag(session, [{"x": a["x"]-60, "y": a["y"]-60}, {"x": b["x"]+60, "y": b["y"]+60}],
                           ["ctrl"], selected_ids, [], "2 nodes", "multi-selection-range-box")
                verify("range-selected", baseline)
            else:
                native_click("a")
                verify("single-a", baseline, ids=["a"])
                current_stage = "additive-b"
                native_click("b", variant)
                verify("additive-b", baseline)
                native_click("b", variant)
                verify("toggle-b-off", baseline, ids=["a"])
                native_click("b", variant)
                verify("toggle-b-on", baseline)

            session.wait("return !document.querySelector('.ge-select-node-hitbox')?.closest('[inert]')")
            session.screenshot(f"multi-selection-{variant}-selected")
            current_stage = "drag-preview"
            start = point("a")
            session.command("POST", "/actions", {"actions": [{"type": "pointer", "id": "mouse", "parameters": {"pointerType": "mouse"}, "actions": [
                {"type": "pointerMove", "duration": 0, "origin": "viewport", "x": round(start["x"]), "y": round(start["y"])},
                {"type": "pointerDown", "button": 0},
                {"type": "pointerMove", "duration": 400, "origin": "pointer", "x": 60, "y": 40}]}]})
            after_drag = moved(baseline, 60, 40)
            live_projection = [[n["id"], n["x"], n["y"]] for n in after_drag["nodes"]]
            session.wait(RANGE_CY + "return JSON.stringify(cy.nodes().map(n=>[n.id(),n.position('x'),n.position('y')]))===JSON.stringify(" + json.dumps(live_projection) + ");")
            preview = snapshot()
            assert preview["selectedNodes"] == selected_ids and preview["summary"] == "2 nodes", (variant, preview)
            assert preview["saved"] == baseline, "The group preview must not persist before pointer release"
            (OUTPUT / f"multi-selection-{variant}-drag-preview.json").write_text(json.dumps(preview, indent=2))
            session.command("POST", "/actions", {"actions": [{"type": "pointer", "id": "mouse", "parameters": {"pointerType": "mouse"}, "actions": [
                {"type": "pointerUp", "button": 0}]}]})
            session.command("DELETE", "/actions")
            verify("drag-committed", after_drag)

            range_key(session, "\ue014")
            after_right = moved(after_drag, 1, 0)
            verify("arrow-right", after_right)
            session.command("POST", "/actions", {"actions": [{"type": "key", "id": "keyboard", "actions": [
                {"type": "keyDown", "value": RANGE_KEYS["shift"]},
                {"type": "keyDown", "value": "\ue015"}, {"type": "keyUp", "value": "\ue015"},
                {"type": "keyUp", "value": RANGE_KEYS["shift"]}]}]})
            keyboard_limit = None
            if session.js("const keys=window.__multiKeys.slice(-4);return keys.some(e=>e.type==='keydown'&&e.shift&&e.key==='\\u001f')&&!keys.some(e=>e.type==='keydown'&&e.key==='ArrowDown');"):
                # SafariDriver 26.6 emits U+001F rather than ArrowDown for this
                # native chord. Exercise the shortcut through an explicit DOM
                # event and record the limit; correct native events never retry.
                session.js("document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',code:'ArrowDown',shiftKey:true,bubbles:true,cancelable:true}));document.body.dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowDown',code:'ArrowDown',shiftKey:true,bubbles:true}));document.body.dispatchEvent(new KeyboardEvent('keyup',{key:'Shift',code:'ShiftLeft',shiftKey:false,bubbles:true}));")
                keyboard_limit = "SafariDriver sent U+001F for Shift+ArrowDown; shifted nudge used a DOM KeyboardEvent"
            session.command("DELETE", "/actions")
            after_down = moved(after_right, 0, 10)
            before_color = verify("shift-arrow-down", after_down)
            current_stage = "palette-green-click"
            session.js("""window.__multiPaletteEvents=[];
                for(const type of ['pointerdown','pointerup','click'])document.addEventListener(type,e=>{
                    const button=e.target.closest?.('button');
                    window.__multiPaletteEvents.push({type,label:button?.getAttribute('aria-label')??null,
                        target:e.target.tagName,x:e.clientX,y:e.clientY,shift:e.shiftKey,
                        ctrl:e.ctrlKey,meta:e.metaKey,trusted:e.isTrusted});
                },true);
                const button=document.querySelector('[role=radio][aria-label="Node color: Green"]');
                const r=button.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;
                window.__multiPaletteClick={rect:{x:r.x,y:r.y,width:r.width,height:r.height},
                    hit:document.elementFromPoint(x,y)?.closest('button')?.getAttribute('aria-label'),
                    animations:button.closest('[role=toolbar]')?.getAnimations().map(a=>({state:a.playState,time:a.currentTime}))};
            """)
            session.activate(session.element('[role=radio][aria-label="Node color: Green"]'))
            after_color = json.loads(json.dumps(after_down))
            for node in after_color["nodes"]:
                if node["id"] in selected_ids:
                    node["color"] = "green"
            before_fills = {node["id"]: node["fill"] for node in before_color["liveNodes"]}
            session.wait(RANGE_CY + "const before=" + json.dumps(before_fills) + ";return cy.nodes().every(n=>['a','b'].includes(n.id()) ? n.style('background-color')!==before[n.id()] && n.style('background-color')===cy.getElementById('a').style('background-color') : n.style('background-color')===before[n.id()]);")
            verify("palette-green", after_color)
            assert session.js("return document.querySelector('[role=radio][aria-label=\"Node color: Green\"]')?.getAttribute('aria-checked')") == "true"
            session.screenshot(f"multi-selection-{variant}-edited")

            for stage, expected in (("undo-color", after_down), ("undo-shift-arrow", after_right),
                                    ("undo-arrow", after_drag), ("undo-drag", baseline)):
                session.activate(session.button("Undo"))
                verify(stage, expected)
            # Redo keeps the saved result meaningful for the reload check.
            for stage, expected in (("redo-drag", after_drag), ("redo-arrow", after_right),
                                    ("redo-shift-arrow", after_down), ("redo-color", after_color)):
                session.activate(session.button("Redo"))
                verify(stage, expected)
            session.refresh()
            session.wait("return !!document.querySelector('[data-canvas-ready=true]') && document.querySelectorAll('.ge-select-node-hitbox').length===4")
            restored = snapshot()
            assert restored["saved"] == after_color, (variant, "reload", restored)
            assert [(n["id"], n["x"], n["y"]) for n in restored["liveNodes"]] == [(n["id"], n["x"], n["y"]) for n in after_color["nodes"]], (variant, "reload", restored)
            stages.append({"stage": "reload", **restored})
            results.append({"variant": variant, "status": "passed", "stages": stages, "keyboardLimit": keyboard_limit})
            (OUTPUT / "multi-selection-results.json").write_text(json.dumps({"status": "passed" if len(results) == 3 else "in_progress", "results": results}, indent=2))
        except Exception as error:
            failure = {"variant": variant, "stage": current_stage, "error": str(error), "snapshot": snapshot(), "completedStages": stages}
            (OUTPUT / "multi-selection-failure.json").write_text(json.dumps(failure, indent=2))
            session.screenshot(f"multi-selection-{variant}-failure")
            raise
    return results


def run_enlarged_routing_review(session):
    """Real rendered edge clearance after a runtime root-text size change."""
    results = []
    report = OUTPUT / "enlarged-routing-results.json"
    fixture = {**RANGE_FIXTURE,
               "settings": {**RANGE_FIXTURE["settings"], "autoEdgeRouting": True},
               "nodes": [{"id": "a", "label": "A", "order": 0, "x": -200, "y": 0},
                         {"id": "b", "label": "B", "order": 1, "x": 200, "y": 0},
                         {"id": "c", "label": "C", "order": 2, "x": 0, "y": 35}],
               "edges": [{"id": "ab", "source": "a", "target": "b"}]}
    try:
        for theme in ("light", "dark"):
            if results:
                session.restart()
            session.command("POST", "/window/rect", {"width": 1440, "height": 1000}, check=False)
            session.navigate("/en")
            session.wait("return !!document.querySelector('[data-canvas-ready=true]')")
            session.focus_window()
            session.js("document.documentElement.style.fontSize='16px';")
            if session.js("return document.documentElement.dataset.theme") != theme:
                session.activate(session.button("Switch to " + theme + " mode"))
            session.open_panel("Load a graph", "starter")
            textarea = session.element('[data-editor-panel=starter] textarea')
            session.command("POST", f"/element/{textarea}/value", {"text": json.dumps(fixture)})
            session.wait("return [...document.querySelectorAll('[data-editor-panel=starter] button')].some(e=>e.textContent.trim()==='Apply to graph'&&!e.disabled)")
            session.activate(session.button("Apply to graph"))
            session.wait(RANGE_CY + "return cy.nodes().length===3&&cy.edges().length===1&&cy.nodes().every(n=>Math.abs(n.height()-48)<0.01)&&cy.getElementById('ab').data('bow')===0;")
            baseline = session.js(RANGE_CY + "return cy.nodes().map(n=>({id:n.id(),x:n.position('x'),y:n.position('y')}));")
            session.js("performance.clearMarks('graph-compute:routing:worker');performance.clearMarks('graph-compute:routing:wasm:routing_node_shape');document.documentElement.style.fontSize='24px';")
            session.wait(RANGE_CY + "return cy.nodes().every(n=>Math.abs(n.height()-72)<0.01)&&Math.abs(cy.getElementById('ab').data('bow'))>0;")
            session.wait("return !!document.querySelector('[data-canvas-ready=true]')&&!document.querySelector('[data-editor-panel=starter]')&&document.querySelectorAll('.ge-select-node-hitbox').length===3;")
            session.wait("return performance.getEntriesByName('graph-compute:routing:worker').length>0&&performance.getEntriesByName('graph-compute:routing:wasm:routing_node_shape').length>0;")
            enlarged = session.js(RANGE_CY + """
                const edge=cy.getElementById('ab'),node=cy.getElementById('c');
                const controls=edge.controlPoints();
                if(!controls?.length)throw new Error('Enlarged obstacle must produce a rendered curve');
                const source=edge.sourceEndpoint(),target=edge.targetEndpoint(),p=node.position();
                const radius=node.height()/2,span=Math.max(0,(node.width()-node.height())/2);
                const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
                let gap=Infinity;
                for(let piece=0;piece<controls.length;piece++){
                    const a=piece===0?source:mid(controls[piece-1],controls[piece]);
                    const b=piece===controls.length-1?target:mid(controls[piece],controls[piece+1]);
                    const c=controls[piece];
                    for(let i=0;i<=2000;i++){
                        const t=i/2000,u=1-t;
                        const x=u*u*a.x+2*u*t*c.x+t*t*b.x;
                        const y=u*u*a.y+2*u*t*c.y+t*t*b.y;
                        gap=Math.min(gap,Math.hypot(Math.max(0,Math.abs(x-p.x)-span),y-p.y)-radius);
                    }
                }
                return {minimumCurveGapPx:gap,nodeHeight:node.height(),nodeWidth:node.width(),bow:edge.data('bow'),
                    nodes:cy.nodes().map(n=>({id:n.id(),x:n.position('x'),y:n.position('y')}))};
            """)
            assert enlarged["minimumCurveGapPx"] >= 4, enlarged
            assert enlarged["nodes"] == baseline, "Text resizing must not change model coordinates"
            session.js(RANGE_CY + "cy.zoom(1);cy.pan({x:container.clientWidth/2,y:450});window.__routingPainted=false;cy.one('render',()=>requestAnimationFrame(()=>window.__routingPainted=true));cy.forceRender();")
            session.wait("return window.__routingPainted===true")
            session.screenshot("routing-enlarged-text-" + theme)
            session.js("document.documentElement.style.fontSize='16px';")
            session.wait(RANGE_CY + "return cy.nodes().every(n=>Math.abs(n.height()-48)<0.01)&&cy.getElementById('ab').data('bow')===0;")
            assert session.js(RANGE_CY + "return cy.nodes().map(n=>({id:n.id(),x:n.position('x'),y:n.position('y')}));") == baseline
            results.append({"theme": theme, "status": "passed", "rootTextSizesPx": [16, 24, 16],
                            "nodeHeightsPx": [48, 72, 48], "coordinatesPreserved": True,
                            "workerAndWasmUsed": True, "enlarged": enlarged})
            report.write_text(json.dumps({"status": "running", "results": results}, indent=2))
            print("Safari enlarged routing " + theme + ": 48→72→48px, rendered clearance and worker rerouting passed", flush=True)
        report.write_text(json.dumps({"status": "passed", "results": results,
                                     "limits": ["Root text size simulation in desktop Safari", "Storage is covered by the separate persistence stages"]}, indent=2))
        return results
    except Exception as error:
        report.write_text(json.dumps({"status": "failed_or_blocked", "results": results, "error": str(error)}, indent=2))
        raise


def run_rust_compute_review(session):
    """Expert review of the real editor and its deployed Worker/Wasm assets."""
    session.command("POST", "/window/rect", {"width": 1440, "height": 1000}, check=False)
    results = []

    def load(fixture):
        session.navigate("/en")
        session.js("localStorage.clear();localStorage.setItem('graph-editor-graph',arguments[0]);localStorage.setItem('graph-editor-theme','light');", json.dumps(fixture))
        session.refresh()
        session.wait("return !!document.querySelector('[data-canvas-ready=true]')", timeout=30)

    def saved():
        return session.js("return JSON.parse(localStorage.getItem('graph-editor-graph'))")

    def mark(kind, kernel=None):
        # Worker completion also covers deliberately selected JS paths. Rust
        # scenarios require evidence from the exact numerical operation.
        suffix = f"wasm:{kernel}" if kernel else ("wasm" if kind == "import" else "worker")
        name = json.dumps(f"graph-compute:{kind}:{suffix}")
        condition = f"return performance.getEntriesByName({name}).at(-1)"
        if kernel:
            condition += "?.detail?.calls > 0"
        return session.wait(condition, timeout=30)

    # Start with an empty graph so input-time loading, rather than canvas
    # routing, makes the Rust integer scanner available before the preview.
    load({**RANGE_FIXTURE, "nodes": [], "edges": []})
    session.open_panel("Load a graph", "starter")
    matrix_text = "\n".join(" ".join("1" if abs(source - target) == 1 else "0"
                                   for target in range(128)) for source in range(128))
    textarea = session.element("textarea")
    session.js("const e=arguments[0];Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,arguments[1]);e.dispatchEvent(new Event('input',{bubbles:true}));", {ELEMENT: textarea}, matrix_text)
    mark("import")
    session.wait("return [...document.querySelectorAll('[data-editor-panel=starter] button')].some(e=>e.textContent.trim()==='Apply to graph'&&!e.disabled)")
    session.screenshot("rust-integer-matrix-preview-128")
    session.activate(session.button("Apply to graph"))
    session.wait("const g=JSON.parse(localStorage.getItem('graph-editor-graph'));return g?.nodes.length===128&&g?.edges.length===127&&!document.querySelector('[data-editor-panel=starter]')")
    matrix_saved = saved()
    assert matrix_saved["nodes"][0]["label"] == "0"
    assert matrix_saved["edges"][0]["source"] == "n0" and matrix_saved["edges"][0]["target"] == "n1"
    session.activate(session.button("Undo"))
    session.wait("return JSON.parse(localStorage.getItem('graph-editor-graph')).nodes.length===0")
    session.activate(session.button("Redo"))
    session.wait("return JSON.parse(localStorage.getItem('graph-editor-graph')).nodes.length===128")
    assert saved() == matrix_saved
    session.refresh()
    session.wait("return !!document.querySelector('[data-canvas-ready=true]')", timeout=30)
    assert saved() == matrix_saved
    results.append({"scenario": "integer-matrix-128", "status": "passed", "rustPreview": True,
                    "undoRedo": True, "reloadPreserved": True,
                    "inputMethod": "textarea value setter and input event"})
    (OUTPUT / "rust-compute-progress.json").write_text(json.dumps({"status": "in_progress", "results": results}, indent=2))
    print("Rust integer matrix: preview, Apply, Undo/Redo and reload passed", flush=True)

    chain = {**RANGE_FIXTURE,
             "nodes": [{"id": f"n{i}", "label": str(i), "order": i, "x": i * 20, "y": 0} for i in range(200)],
             "edges": [{"id": f"e{i}", "source": f"n{i}", "target": f"n{i + 1}"} for i in range(199)]}
    load(chain)
    baseline = saved()
    session.open_panel("Layout", "layouts")
    session.js("window.__rustFrames=0;window.__rustFrameActive=true;const tick=()=>{if(window.__rustFrameActive){window.__rustFrames++;requestAnimationFrame(tick)}};requestAnimationFrame(tick);")
    started = time.monotonic()
    session.activate(session.button("Auto layout: Force-directed"))
    mark("layout", "force_layout")
    session.wait("const g=JSON.parse(localStorage.getItem('graph-editor-graph'));return g.nodes.some(n=>n.y!==0)")
    laid_out = saved()
    frame_count = session.js("window.__rustFrameActive=false;return window.__rustFrames")
    assert frame_count > 0, "The editor renders during the complete layout workflow"
    assert len(laid_out["nodes"]) == 200 and len(laid_out["edges"]) == 199
    assert all(isinstance(n["x"], (int, float)) and isinstance(n["y"], (int, float)) for n in laid_out["nodes"])
    session.screenshot("rust-force-200")
    session.activate(session.button("Undo"))
    session.wait("return JSON.parse(localStorage.getItem('graph-editor-graph')).nodes.every(n=>n.y===0)")
    assert saved() == baseline, "Worker result is one undoable command"
    session.activate(session.button("Redo"))
    session.wait("return JSON.parse(localStorage.getItem('graph-editor-graph')).nodes.some(n=>n.y!==0)")
    assert saved() == laid_out
    session.refresh()
    session.wait("return !!document.querySelector('[data-canvas-ready=true]')", timeout=30)
    assert saved() == laid_out, "Computed positions persist after reload"
    results.append({"scenario": "force-200", "status": "passed", "workflowFrames": frame_count,
                    "workflowSeconds": time.monotonic() - started,
                    "limits": "Duration and frames include WebDriver commands and debounced saving; they do not isolate rendering during CPU computation"})

    session.open_panel("Layout", "layouts")
    session.js("document.querySelector('[aria-label=\"Auto layout: Force-directed\"]').click();document.querySelector('[aria-label^=\"Grid:\"]').click();")
    session.wait("return !document.querySelector('[data-editor-panel=layouts] [role=status]')")
    # Pending computation ends before the debounced storage write. Verify the
    # actual Grid result has persisted before testing that it stays unchanged.
    session.wait("const g=JSON.parse(localStorage.getItem('graph-editor-graph'));return g.nodes.every((n,i)=>n.x===(i%15)*128&&n.y===Math.floor(i/15)*104)")
    grid = saved()
    time.sleep(0.5)
    assert saved() == grid, "Superseded force result cannot replace Grid"
    results.append({"scenario": "superseded-layout", "status": "passed"})

    crowded = {**RANGE_FIXTURE,
               "settings": {**RANGE_FIXTURE["settings"], "snapToGrid": True},
               "nodes": [{"id": f"n{i}", "label": str(i), "order": i, "x": 0, "y": 0} for i in range(80)],
               "edges": []}
    load(crowded)
    baseline = saved()
    session.open_panel("Layout", "layouts")
    session.activate(session.button("Resolve overlap: Move nodes apart"))
    mark("overlap", "resolve_overlaps")
    session.wait("return JSON.parse(localStorage.getItem('graph-editor-graph')).nodes.some(n=>n.y!==0)")
    separated = saved()
    assert all(n["x"] % 24 == 0 and n["y"] % 24 == 0 for n in separated["nodes"])
    for i, node in enumerate(separated["nodes"]):
        for other in separated["nodes"][i + 1:]:
            assert ((node["x"]-other["x"])**2 + (node["y"]-other["y"])**2)**0.5 >= 60 - 0.00001
    session.screenshot("rust-overlap-80")
    session.activate(session.button("Undo"))
    session.wait("return JSON.parse(localStorage.getItem('graph-editor-graph')).nodes.every(n=>n.x===0&&n.y===0)")
    assert saved() == baseline
    results.append({"scenario": "overlap-80", "status": "passed", "gridPreserved": True})

    loops = {**RANGE_FIXTURE,
             "settings": {**RANGE_FIXTURE["settings"], "autoEdgeRouting": True},
             "nodes": [{"id": "a", "label": "0", "order": 0, "x": 0, "y": 0}],
             "edges": [{"id": f"loop-{i}", "source": "a", "target": "a"} for i in range(10)]}
    load(loops)
    mark("routing")
    snapshot = session.js(RANGE_CY + "return cy.edges().map(e=>({id:e.id(),direction:e.data('loopDirection'),sweep:e.data('loopSweep'),points:e.controlPoints()}));")
    assert len(snapshot) == 10 and len(set(e["direction"] for e in snapshot)) == 10
    session.screenshot("rust-routing-10-loops")
    session.refresh()
    session.wait("return !!document.querySelector('[data-canvas-ready=true]')", timeout=30)
    mark("routing")
    assert session.js(RANGE_CY + "return cy.edges().map(e=>({id:e.id(),direction:e.data('loopDirection'),sweep:e.data('loopSweep'),points:e.controlPoints()}));") == snapshot
    results.append({"scenario": "routing-10-loops", "status": "passed", "reloadPreserved": True})

    wide_loops = {**loops,
                  "nodes": [{"id": "a", "label": "幅のある自己ループ頂点", "order": 0, "x": 0, "y": 0}],
                  "edges": [{"id": f"wide-loop-{i}", "source": "a", "target": "a", "label": f"label {i}"} for i in range(32)]}
    load(wide_loops)
    mark("routing")
    session.wait(RANGE_CY + "return cy.edges().length===32&&cy.getElementById('a').width()>48")
    wide_saved = saved()
    wide_snapshot = session.js(RANGE_CY + "return cy.edges().map(e=>({id:e.id(),direction:e.data('loopDirection'),sweep:e.data('loopSweep'),points:e.controlPoints()}));")
    assert len(wide_snapshot) == 32
    session.screenshot("routing-wide-32-loops")
    session.refresh()
    session.wait("return !!document.querySelector('[data-canvas-ready=true]')", timeout=30)
    mark("routing")
    assert session.js(RANGE_CY + "return cy.edges().map(e=>({id:e.id(),direction:e.data('loopDirection'),sweep:e.data('loopSweep'),points:e.controlPoints()}));") == wide_snapshot
    assert saved() == wide_saved, "Loop scratch preparation must not persist geometry"
    results.append({"scenario": "routing-wide-32-loops", "status": "passed", "reloadPreserved": True})
    (OUTPUT / "rust-compute-progress.json").write_text(json.dumps({"status": "in_progress", "results": results}, indent=2))
    print("Wide 32-loop routing and reload passed", flush=True)

    obstacle = {**RANGE_FIXTURE,
                "settings": {**RANGE_FIXTURE["settings"], "autoEdgeRouting": True},
                "nodes": [{"id": "a", "label": "A", "order": 0, "x": -160, "y": 0},
                          {"id": "b", "label": "B", "order": 1, "x": 160, "y": 0},
                          {"id": "c", "label": "C", "order": 2, "x": 0, "y": 180}],
                "edges": [{"id": "ab", "source": "a", "target": "b"}]}
    load(obstacle)
    mark("routing")
    session.wait(RANGE_CY + "return cy.getElementById('ab').data('bow')===0")
    baseline = saved()
    start = session.js(RANGE_CY + "cy.zoom(1);cy.pan({x:container.clientWidth/2,y:400});const p=cy.getElementById('c').renderedPosition(),r=container.getBoundingClientRect();performance.clearMarks('graph-compute:routing:worker');performance.clearMarks('graph-compute:routing:wasm:routing_node_shape');return {x:p.x+r.x,y:p.y+r.y};")
    # The DOM hitboxes follow Cytoscape's viewport on the next animation frame.
    # Start only when the real pointer target agrees with the requested view.
    session.wait("""const e=document.querySelector('button[aria-label="Select node C"]');
        if(!e||e.closest('[inert]'))return false;const r=e.getBoundingClientRect();
        return Math.abs(r.x+r.width/2-""" + str(start["x"]) + ")<0.5&&Math.abs(r.y+r.height/2-" + str(start["y"]) + ")<0.5&&document.elementFromPoint(" + str(round(start["x"])) + "," + str(round(start["y"])) + ")?.closest('button')===e;")
    session.js("""window.__routingDragEvents=[];
        for(const type of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture','mousedown','mousemove','mouseup','focus','blur'])window.addEventListener(type,e=>{
            window.__routingDragEvents.push({type,x:e.clientX,y:e.clientY,buttons:e.buttons,target:e.target===window?'window':e.target.tagName,label:e.target.closest?.('button')?.getAttribute('aria-label')});
            window.__routingDragEvents=window.__routingDragEvents.slice(-100);
        },true);""")
    session.focus_window()
    session.click(session.element('button[aria-label="Select node C"]'))
    session.command("POST", "/actions", {"actions": [{"type": "pointer", "id": "mouse", "parameters": {"pointerType": "mouse"}, "actions": [
        {"type": "pointerMove", "duration": 150, "origin": "viewport", "x": round(start["x"]), "y": round(start["y"])},
        {"type": "pointerDown", "button": 0},
        {"type": "pause", "duration": 50},
        {"type": "pointerMove", "duration": 400, "origin": "pointer", "x": 0, "y": -180}]}]})
    try:
        session.wait(RANGE_CY + "return cy.getElementById('c').position('y')===0&&Math.abs(cy.getElementById('ab').data('bow'))>0")
    except AssertionError as error:
        snapshot = session.js(RANGE_CY + "return {position:cy.getElementById('c').position(),bow:cy.getElementById('ab').data('bow'),events:window.__routingDragEvents};")
        raise AssertionError("Native obstacle drag failed: " + json.dumps(snapshot)) from error
    mark("routing", "routing_node_shape")
    assert saved() == baseline, "Worker routing during drag must not persist the preview"
    def curve_gap():
        return session.js(RANGE_CY + """
            const edge=cy.getElementById('ab'),node=cy.getElementById('c');
            const control=edge.controlPoints();
            if(!control?.length)throw new Error('Expected rendered quadratic control points');
            const source=edge.sourceEndpoint(),target=edge.targetEndpoint(),p=node.position();
            const radius=node.height()/2,span=Math.max(0,(node.width()-node.height())/2);
            let gap=Infinity;
            const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
            for(let piece=0;piece<control.length;piece++){
                const a=piece===0?source:mid(control[piece-1],control[piece]);
                const b=piece===control.length-1?target:mid(control[piece],control[piece+1]);
                const c=control[piece];
                for(let i=0;i<=1000;i++){
                    const t=i/1000,u=1-t;
                    const x=u*u*a.x+2*u*t*c.x+t*t*b.x;
                    const y=u*u*a.y+2*u*t*c.y+t*t*b.y;
                    gap=Math.min(gap,Math.hypot(Math.max(0,Math.abs(x-p.x)-span),y-p.y)-radius);
                }
            }
            return gap;
        """)
    preview_gap = curve_gap()
    assert preview_gap >= 4, ("The rendered preview curve must clear the obstacle capsule", preview_gap)
    session.screenshot("rust-routing-drag-preview")
    session.command("POST", "/actions", {"actions": [{"type": "pointer", "id": "mouse", "parameters": {"pointerType": "mouse"}, "actions": [
        {"type": "pointerUp", "button": 0}]}]})
    session.command("DELETE", "/actions")
    session.wait("return JSON.parse(localStorage.getItem('graph-editor-graph')).nodes[2].y===0")
    dragged = saved()
    session.activate(session.button("Undo"))
    session.wait(RANGE_CY + "return JSON.parse(localStorage.getItem('graph-editor-graph')).nodes[2].y===180&&cy.getElementById('ab').data('bow')===0")
    assert saved() == baseline
    session.activate(session.button("Redo"))
    session.wait(RANGE_CY + "return JSON.parse(localStorage.getItem('graph-editor-graph')).nodes[2].y===0&&Math.abs(cy.getElementById('ab').data('bow'))>0")
    assert saved() == dragged
    committed_gap = curve_gap()
    assert committed_gap >= 4, ("The rendered curve after Redo must clear the obstacle capsule", committed_gap)
    session.screenshot("rust-routing-drag-committed")
    results.append({"scenario": "routing-native-obstacle-drag", "status": "passed", "previewOnlyUntilRelease": True, "undoRedoRouting": True,
                    "minimumPreviewCurveGapPx": preview_gap, "minimumCommittedCurveGapPx": committed_gap})

    # The 64-node projection gate must also work with the browser's measured
    # capsule width. Other nodes stay far away so this isolates one obstacle.
    projected = {**obstacle,
                 "nodes": [{"id": "a", "label": "A", "order": 0, "x": -220, "y": 0},
                           {"id": "b", "label": "B", "order": 1, "x": 220, "y": 0},
                           {"id": "c", "label": "幅のある頂点ラベル", "order": 2, "x": 0, "y": 0}]
                          + [{"id": f"far{i}", "label": str(i), "order": i + 3,
                              "x": 10000 + i * 120, "y": 10000} for i in range(61)]}
    load(projected)
    mark("routing", "routing_projected_obstacles")
    projected_saved = saved()
    assert len(projected_saved["nodes"]) == 64
    session.wait(RANGE_CY + "return Math.abs(cy.getElementById('ab').data('bow'))>0")
    session.js(RANGE_CY + "cy.zoom(1);cy.pan({x:container.clientWidth/2,y:400});")
    projected_gap = curve_gap()
    assert projected_gap >= 4, ("The projected route must clear the measured wide capsule", projected_gap)
    projected_route = session.js(RANGE_CY + "return {distances:cy.getElementById('ab').data('controlPointDistances'),weights:cy.getElementById('ab').data('controlPointWeights')};")
    session.screenshot("rust-projected-wide-obstacle-64")
    session.refresh()
    session.wait("return !!document.querySelector('[data-canvas-ready=true]')", timeout=30)
    mark("routing", "routing_projected_obstacles")
    assert session.js(RANGE_CY + "return {distances:cy.getElementById('ab').data('controlPointDistances'),weights:cy.getElementById('ab').data('controlPointWeights')};") == projected_route
    assert saved() == projected_saved, "Automatic projection must not persist routing geometry"
    results.append({"scenario": "routing-projected-wide-obstacle-64", "status": "passed",
                    "minimumCurveGapPx": projected_gap, "reloadPreserved": True})
    (OUTPUT / "rust-compute-results.json").write_text(json.dumps({"status": "passed", "review": "Expert review", "results": results}, indent=2))
    print("Rust/Wasm Safari: force, overlap, routing, cancellation, undo/redo and persistence passed", flush=True)
    return results


def run_promo_recording(session):
    """Record a fixed local app introduction; frame holds are editorial timing."""
    output = OUTPUT / f"promo-attempt-{time.time_ns()}"
    output.mkdir()
    published = OUTPUT / "promo"
    frames = []
    fallbacks = []
    started = time.monotonic()

    def capture(scene, seconds, settle=0.25):
        time.sleep(settle)
        name = f"{len(frames):03d}-{scene}.png"
        path = output / name
        pixels = base64.b64decode(session.command("GET", "/screenshot"))
        dimensions = {"width": int.from_bytes(pixels[16:20], "big"), "height": int.from_bytes(pixels[20:24], "big")}
        assert dimensions == {"width": viewport["width"], "height": viewport["height"]}, (scene, dimensions, viewport)
        path.write_bytes(pixels)
        frames.append({"file": str(published / name), "scene": scene, "durationSeconds": seconds,
                       "capturedAtSeconds": time.monotonic() - started})

    def saved():
        return session.js("return JSON.parse(localStorage.getItem('graph-editor-graph'))")

    def operate(label, effect, selector=None):
        element = session.element(selector) if selector else session.button(label)
        session.click(element)
        try:
            return session.wait(effect, timeout=1)
        except AssertionError:
            # SafariDriver occasionally swallows a click in its unfocused
            # window. Invoke only the same real local control and validate it.
            session.js("arguments[0].click()", {ELEMENT: element})
            fallbacks.append({"control": label, "method": "local DOM button.click after swallowed native click"})
            return session.wait(effect, timeout=30)

    session.command("POST", "/window/rect", {"width": 1280, "height": 770}, check=False)
    session.navigate("/")
    # SafariDriver owns an isolated automation window. Do not touch the user's
    # normal browsing data, clipboard, downloads or other applications.
    session.js("localStorage.clear();localStorage.setItem('graph-editor-theme','dark');")
    session.refresh()
    session.wait("return !!document.querySelector('[data-canvas-ready=true]')", timeout=30)
    # Select only this driver's own automation window before native gestures.
    handle = session.command("GET", "/window")
    session.command("POST", "/window", {"handle": handle})
    viewport = session.js("return {width:innerWidth,height:innerHeight,devicePixelRatio}")
    capture("empty", 2.0)

    operate("グラフを読み込む", "return !!document.querySelector('[data-editor-panel=starter]')")
    capture("load-panel", 1.5)
    # A small binary tree stays readable at the video's final display size.
    text = "15 14\n" + "\n".join(f"{child // 2} {child}" for child in range(2, 16))
    textarea = session.element("textarea")
    session.command("POST", f"/element/{textarea}/value", {"text": text})
    session.wait("return [...document.querySelectorAll('[data-editor-panel=starter] button')].some(e=>e.textContent.trim()==='グラフに反映'&&!e.disabled)")
    capture("pasted-tree", 2.5)
    operate("グラフに反映", "const g=JSON.parse(localStorage.getItem('graph-editor-graph')||'null');return g?.nodes.length===15&&g?.edges.length===14&&!document.querySelector('[data-editor-panel=starter]')")
    session.wait("return document.querySelectorAll('.ge-select-node-hitbox').length===15")
    imported = saved()
    capture("imported-tree", 3.0)

    operate("配置", "return !!document.querySelector('[data-editor-panel=layouts]')")
    capture("layout-panel", 1.5)
    operate("自動配置: 力学モデル", "return performance.getEntriesByName('graph-compute:layout:wasm:force_layout').at(-1)?.detail?.calls>0")
    session.wait("return !document.querySelector('[data-editor-panel=layouts] [role=status]')")
    session.wait("const g=JSON.parse(localStorage.getItem('graph-editor-graph'));return JSON.stringify(g.nodes.map(n=>[n.x,n.y]))!==" + json.dumps(json.dumps([[n["x"], n["y"]] for n in imported["nodes"]], separators=(",", ":"))))
    rust_mark = session.js("const mark=performance.getEntriesByName('graph-compute:layout:wasm:force_layout').at(-1);return {name:mark.name,startTime:mark.startTime,detail:mark.detail};")
    capture("rust-layout-result", 1.5)
    operate("配置", "return !document.querySelector('[data-editor-panel=layouts]')")
    capture("laid-out-tree", 3.0)

    operate("頂点 1を選択", "return !!document.querySelector('[role=radio][aria-label=\"頂点の色: 緑\"]')", ".ge-select-node-hitbox")
    capture("selected-node", 1.5)
    operate("頂点の色: 緑", "return JSON.parse(localStorage.getItem('graph-editor-graph')).nodes[0].color==='green'", '[role=radio][aria-label="頂点の色: 緑"]')
    capture("green-node", 1.5)
    before_drag = saved()["nodes"][0]
    drag_start = session.js("const r=document.querySelector('.ge-select-node-hitbox').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};")
    zoom = session.js(RANGE_CY + "return cy.zoom();")
    capture("drag-start", 1.5, settle=0.04)
    drag_actions = [
        {"type": "pointerMove", "duration": 0, "origin": "viewport", "x": drag_start["x"], "y": drag_start["y"]},
        {"type": "pointerDown", "button": 0}]
    for step in range(18):
        drag_actions.append({"type": "pointerMove", "duration": 50, "origin": "viewport",
                             "x": drag_start["x"] + 4 * (step + 1), "y": drag_start["y"] + 2 * (step + 1)})
    drag_actions.append({"type": "pointerUp", "button": 0})
    session.command("POST", "/actions", {"actions": [{"type": "pointer", "id": "promo-drag", "parameters": {"pointerType": "mouse"}, "actions": drag_actions}]})
    session.command("DELETE", "/actions")
    session.wait("return JSON.parse(localStorage.getItem('graph-editor-graph')).nodes[0].x!==" + str(before_drag["x"]))
    edited = saved()
    assert edited["nodes"][0]["color"] == "green"
    assert abs(edited["nodes"][0]["x"] - before_drag["x"] - 72 / zoom) < 0.0001
    assert abs(edited["nodes"][0]["y"] - before_drag["y"] - 36 / zoom) < 0.0001
    assert len(edited["nodes"]) == 15 and len(edited["edges"]) == 14
    rendered_node = session.js("const r=document.querySelector('.ge-select-node-hitbox').getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom};")
    assert rendered_node["left"] >= 0 and rendered_node["right"] <= viewport["width"]
    assert rendered_node["top"] >= 0 and rendered_node["bottom"] <= viewport["height"]
    capture("dragged-node", 2.5)

    # Escape dismisses the selection so the export scene is uncluttered.
    range_key(session, "\ue00c")
    operate("書き出し", "return !!document.querySelector('[data-editor-panel=export]')")
    session.command("POST", f"/element/{session.element('[data-editor-panel=export] select')}/value", {"text": "JSON"})
    exported_text = session.wait("const e=document.querySelector('[data-editor-panel=export] pre');return e&&e.textContent.trim().startsWith('{')&&e.textContent;")
    exported = json.loads(exported_text)
    assert exported["nodes"] == edited["nodes"] and exported["edges"] == edited["edges"]
    (output / "edited-graph.json").write_text(exported_text)
    capture("json-export", 2.0)
    preview = operate("PNG 画像", "const img=document.querySelector('[data-editor-panel=png] img');return img&&img.complete&&img.naturalWidth>0&&{width:img.naturalWidth,height:img.naturalHeight,alt:img.alt};")
    # A native WebDriver click scrolls the image into the panel's visible body.
    session.click(session.element('[data-editor-panel=png] img'))
    session.js("document.querySelector('[data-editor-panel=png] img').scrollIntoView({block:'nearest'});")
    fallbacks.append({"control": "PNG preview", "method": "local DOM scrollIntoView to display the generated preview"})
    # Copy the already-rendered local PNG pixels without a blob network request.
    png_data = session.js("""
        const img=document.querySelector('[data-editor-panel=png] img');
        if(!img.src.startsWith('blob:http://127.0.0.1:3323/')) throw new Error('Unexpected preview URL');
        const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
        canvas.getContext('2d').drawImage(img,0,0);return canvas.toDataURL('image/png');
    """)
    assert png_data.startswith("data:image/png;base64,")
    (output / "exported-graph.png").write_bytes(base64.b64decode(png_data.split(",", 1)[1]))
    capture("png-preview", 3.5)
    operate("PNG を閉じる", "return !document.querySelector('[data-editor-panel=png]')", '[data-editor-panel=png] button[aria-label="閉じる"]')
    capture("final-tree", 3.5)

    manifest = {"scenario": "app-introduction", "status": "passed", "origin": ORIGIN,
                "locale": "ja", "theme": "dark", "viewport": viewport,
                "timing": "Editorial frame holds, not a performance benchmark",
                "captureMethod": "Actual local Safari viewport screenshots; native WebDriver actions with validated local-control fallbacks",
                "automationFallbacks": fallbacks,
                "durationSeconds": sum(frame["durationSeconds"] for frame in frames),
                "captureElapsedSeconds": time.monotonic() - started, "frames": frames,
                "evidence": {"nodeCount": 15, "edgeCount": 14, "rustForceMark": rust_mark,
                             "nodeBeforeDrag": before_drag, "nodeAfterDrag": edited["nodes"][0],
                             "renderedNodeAfterDrag": rendered_node, "dragMethod": "Native WebDriver absolute viewport actions in one batch; before/after frames",
                             "jsonExportMatchesSavedGraph": True, "pngPreview": preview},
                "limits": ["Expert demonstration, no first-time human participant",
                           "Frame hold durations were chosen for presentation",
                           "Native file download not tested"]}
    (output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    if published.exists():
        published.rename(OUTPUT / f"promo-previous-{time.time_ns()}")
    output.rename(published)
    print(f"App introduction: {len(frames)} real Safari frames, Rust force, native color/drag, JSON and PNG passed", flush=True)


def main():
    assert sys.argv[1:] in ([], ["--self-loops"], ["--text-weights"]), "This runner accepts only a fixed local scenario, no URL or command overrides"
    policy_checks()
    OUTPUT.mkdir(exist_ok=True)
    driver = subprocess.Popen(["/usr/bin/safaridriver", "-p", "4447"], stdout=(OUTPUT / "driver.log").open("w"), stderr=subprocess.STDOUT)
    session = None
    summary = None
    if not sys.argv[1:] and not (OUTPUT / "promo-request.json").exists():
        summary = {"status": "running", "runId": time.time_ns(), "capabilities": None,
                   "results": [], "completedStages": [],
                   "limits": ["No first-time human participant", "Native file download not checked; exported JSON saved by test runner"]}
        (OUTPUT / "results.json").write_text(json.dumps(summary, indent=2))
    try:
        for _ in range(50):
            try:
                if driver.poll() is not None:
                    raise RuntimeError("The Safari driver exited; refusing to use an unrelated server")
                Session.request("GET", "/status")
                break
            except (urllib.error.URLError, ConnectionError):
                time.sleep(0.1)
        session = Session()
        # Wait for the automation window's first real document before asking
        # Safari's window manager to resize it.
        session.navigate("/")
        session.wait("return document.readyState==='complete'")
        (OUTPUT / "capabilities.json").write_text(json.dumps(session.capabilities, indent=2))
        if summary is not None:
            summary["capabilities"] = session.capabilities
        promo_request = OUTPUT / "promo-request.json"
        if promo_request.exists():
            assert not sys.argv[1:], "The fixed promo scenario requires the no-argument runner"
            assert json.loads(promo_request.read_text()) == {"scenario": "app-introduction"}, "Only the fixed app-introduction scenario is allowed"
            promo_request.unlink()
            run_promo_recording(session)
            return
        if sys.argv[1:] == ["--text-weights"]:
            run_text_weight_review(session)
            return
        if sys.argv[1:] == ["--self-loops"]:
            run_self_loop_review(session)
            return
        def record(stage, results):
            summary["results"].extend(results)
            summary["completedStages"].append({"name": stage, "cases": len(results)})
            (OUTPUT / "results.json").write_text(json.dumps(summary, indent=2))
        (OUTPUT / "results.json").write_text(json.dumps(summary, indent=2))
        stages = [
            ("enlarged-routing", run_enlarged_routing_review, None),
            ("multi-selection", run_multi_selection_review, "multi-selection-results.json"),
            ("range-menu", run_range_menu_review, "range-menu-review.json"),
            ("responsive-text", run_responsive_text_review, None),
            ("design-guidelines", run_design_guidelines_review, None),
            ("editor-workflow", run_editor_review, None),
            ("edge-routing", run_edge_routing_regression, None),
            ("range-selection", run_range_selection, "range-selection-results.json"),
            ("rust-compute", run_rust_compute_review, None),
        ]
        for index, (name, review, report) in enumerate(stages):
            if index:
                session.restart()
            results = review(session)
            if report:
                (OUTPUT / report).write_text(json.dumps({"status": "passed", "results": results}, indent=2))
            record(name, results)
        summary["status"] = "awaiting_cleanup"
        (OUTPUT / "results.json").write_text(json.dumps(summary, indent=2))
    except Exception as error:
        if summary is not None:
            summary.update({"status": "failed_or_blocked", "error": str(error)})
            (OUTPUT / "results.json").write_text(json.dumps(summary, indent=2))
        (OUTPUT / "failure.json").write_text(json.dumps({"status": "failed_or_blocked", "error": str(error)}, indent=2))
        if session and not isinstance(error, DriverTimeoutError):
            try:
                (OUTPUT / "failure-state.json").write_text(json.dumps(session.js("return {visibility:document.visibilityState,focused:document.hasFocus(),ready:document.querySelector('[data-canvas-ready]')?.getAttribute('data-canvas-ready'),compute:performance.getEntriesByType('mark').filter(e=>e.name.startsWith('graph-compute:')).map(e=>e.name),trace:window.__focusTrace,active:document.activeElement.tagName,input:document.querySelector('textarea')?.value,panels:[...document.querySelectorAll('[data-editor-panel]')].map(e=>({panel:e.dataset.editorPanel,state:e.dataset.panelState})),buttons:[...document.querySelectorAll('button')].map(e=>({text:e.textContent,label:e.getAttribute('aria-label'),expanded:e.getAttribute('aria-expanded')}))}"), indent=2))
                (OUTPUT / "range-failure-state.json").write_text(json.dumps(session.js("return {events:window.__rangeEvents, nodes:[...document.querySelectorAll('.ge-select-node-hitbox')].map(e=>({label:e.getAttribute('aria-label'),inert:e.closest('[inert]')?.outerHTML.slice(0,400)})), modes:[...document.querySelectorAll('[data-graph-shortcut-target][aria-pressed]')].map(e=>({label:e.getAttribute('aria-label'),pressed:e.getAttribute('aria-pressed')}))}"), indent=2))
                session.screenshot("failure")
            except Exception:
                pass
        raise
    finally:
        active_error = sys.exc_info()[0] is not None
        cleanup = {"runId": summary["runId"] if summary else None,
                   "sessionCreated": session is not None, "sessionClosed": None, "driverStopped": False}
        try:
            if session:
                session.close()
                cleanup["sessionClosed"] = True
        except Exception as error:
            cleanup["error"] = str(error)
            if summary is not None:
                summary.update({"status": "failed_or_blocked", "cleanupError": str(error)})
                (OUTPUT / "results.json").write_text(json.dumps(summary, indent=2))
            if not active_error:
                raise
        finally:
            driver.terminate()
            try:
                driver.wait(timeout=5)
            except subprocess.TimeoutExpired:
                driver.kill()
                driver.wait(timeout=5)
            cleanup["driverStopped"] = driver.poll() is not None
            (OUTPUT / "cleanup.json").write_text(json.dumps(cleanup, indent=2))
            if summary is not None and summary["status"] == "awaiting_cleanup":
                assert cleanup["sessionClosed"] and cleanup["driverStopped"], cleanup
                summary["status"] = "passed"
                (OUTPUT / "results.json").write_text(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
