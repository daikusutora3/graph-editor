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

    @staticmethod
    def request(method, path, data=None):
        payload = None if data is None else json.dumps(data).encode()
        request = urllib.request.Request(DRIVER + path, data=payload, method=method,
                                         headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(request, timeout=40) as response:
                result = json.load(response)
        except urllib.error.HTTPError as error:
            raise RuntimeError(error.read().decode()) from error
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
        self.command("POST", "/url", {"url": url}, check=False)
        assert approved(self.command("GET", "/url"))

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
        self.wait("return [...document.querySelectorAll('button')].some(e=>e.getAttribute('aria-label')===" + json.dumps(label) + "||e.textContent.trim()===" + json.dumps(label) + ")")
        element = self.js("return [...document.querySelectorAll('button')].find(e=>e.getAttribute('aria-label')===arguments[0]||e.textContent.trim()===arguments[0]);", label)
        return element[ELEMENT]

    def click(self, element):
        self.command("POST", f"/element/{element}/click", {})

    def screenshot(self, name):
        time.sleep(0.3)
        (OUTPUT / f"{name}.png").write_bytes(base64.b64decode(self.command("GET", "/screenshot")))

    def close(self):
        self.command("DELETE", "", check=False)


def run(session):
    messages = {
        "ja": {"path": "/", "load": "グラフを読み込む", "apply": "グラフに反映", "export": "書き出し", "save": "再編集用に保存", "image": "画像にする"},
        "en": {"path": "/en", "load": "Load a graph", "apply": "Apply to graph", "export": "Export", "save": "Save for editing", "image": "Create an image"},
        "zh-hans": {"path": "/zh-hans", "load": "加载图", "apply": "应用到图", "export": "导出", "save": "保存以便再编辑", "image": "生成图像"},
    }
    results = []
    for locale, m in messages.items():
        for width in (600, 960, 1440):
            for theme in ("light", "dark"):
                session.command("POST", "/window/rect", {"width": width, "height": 1000}, check=False)
                session.navigate(m["path"])
                # Reset only this isolated Safari automation session's local state.
                session.js("localStorage.clear(); localStorage.setItem('graph-editor-theme',arguments[0]);", theme)
                session.command("POST", "/refresh", {})
                session.wait("return !!document.querySelector('[data-canvas-ready=true]')")
                dimensions = session.js("return {width:innerWidth,height:innerHeight}")
                prefix = f"safari-{locale}-{theme}-{width}"
                session.screenshot(prefix + "-empty")
                opener = session.button(m["load"])
                session.js("arguments[0].focus()", {ELEMENT: opener})
                session.command("POST", "/actions", {"actions": [{"type": "key", "id": "keyboard", "actions": [
                    {"type": "keyDown", "value": "\ue007"}, {"type": "keyUp", "value": "\ue007"}]}]})
                session.wait("return document.querySelector('[data-editor-panel=starter]')?.contains(document.activeElement)")
                session.command("POST", "/actions", {"actions": [{"type": "key", "id": "keyboard", "actions": [
                    {"type": "keyDown", "value": "\ue004"}, {"type": "keyUp", "value": "\ue004"}]}]})
                assert session.js("return document.querySelector('[data-editor-panel=starter]').contains(document.activeElement)"), "Tab stays inside panel"
                session.command("POST", "/actions", {"actions": [{"type": "key", "id": "keyboard", "actions": [
                    {"type": "keyDown", "value": "\ue00c"}, {"type": "keyUp", "value": "\ue00c"}]}]})
                session.wait("return !document.querySelector('[data-editor-panel=starter]')")
                assert session.js("return document.activeElement.getAttribute('aria-label')===arguments[0]", m["load"]), "Escape restores opener"
                session.click(session.button(m["load"]))
                session.js("window.__focusTrace=[];document.addEventListener('focusin',e=>window.__focusTrace.push({event:'focus',tag:e.target.tagName,label:e.target.getAttribute('aria-label'),time:performance.now()}));document.addEventListener('input',e=>window.__focusTrace.push({event:'input',tag:e.target.tagName,value:e.target.value,time:performance.now()}));")
                textarea = session.element("textarea")
                session.command("POST", f"/element/{textarea}/value", {"text": "4 4\n1 2\n2 3\n2 4\n3 4"})
                session.wait("return [...document.querySelectorAll('[data-editor-panel=starter] button')].some(e=>e.textContent.trim()===" + json.dumps(m["apply"]) + "&&!e.disabled)")
                session.screenshot(prefix + "-import")
                session.click(session.button(m["apply"]))
                session.wait("return document.querySelectorAll('button.ge-select-node-hitbox').length===4&&!document.querySelector('[data-editor-panel=starter]')")
                session.click(session.element("button.ge-select-node-hitbox"))
                radios = session.command("POST", "/elements", {"using": "css selector", "value": "[role=radiogroup] [role=radio]"})
                assert radios, "Node color controls appear"
                session.click(radios[-1][ELEMENT])
                session.wait("return JSON.parse(localStorage.getItem('graph-editor-graph')).nodes[0].color==='green'")
                before = session.js("return JSON.parse(localStorage.getItem('graph-editor-graph')).nodes[0]")
                node = session.element("button.ge-select-node-hitbox")
                session.command("POST", "/actions", {"actions": [{"type": "pointer", "id": "mouse", "parameters": {"pointerType": "mouse"}, "actions": [
                    {"type": "pointerMove", "duration": 0, "origin": {ELEMENT: node}, "x": 0, "y": 0},
                    {"type": "pointerDown", "button": 0},
                    {"type": "pointerMove", "duration": 400, "origin": "pointer", "x": 40, "y": 20},
                    {"type": "pointerUp", "button": 0}]}]})
                session.wait("return JSON.parse(localStorage.getItem('graph-editor-graph')).nodes[0].x!==" + str(before["x"]))
                session.click(session.button(m["export"]))
                session.click(session.button(m["save"]))
                text = session.wait("const e=document.querySelector('[data-editor-panel=export] pre');return e&&e.textContent.trim().startsWith('{')&&e.textContent;")
                graph = json.loads(text)
                assert len(graph["nodes"]) == 4 and graph["nodes"][0]["color"] == "green"
                assert graph["nodes"][0]["x"] != before["x"]
                (OUTPUT / f"{prefix}-export.json").write_text(text)
                session.screenshot(prefix + "-export")
                findings = session.js("""return [...document.querySelectorAll('[data-editor-panel] button, [data-editor-chrome-control]')].flatMap(e=>{
                    const r=e.getBoundingClientRect(); return r.width&&r.height&&(r.left< -1||r.right>innerWidth+1||r.top< -1||r.bottom>innerHeight+1)?[{text:e.textContent,x:r.x,y:r.y,width:r.width,height:r.height}]:[];});""")
                assert not findings, findings
                session.click(session.button(m["image"]))
                session.wait("return !!document.querySelector('[data-editor-panel=png] img')")
                session.screenshot(prefix + "-png")
                session.command("POST", "/refresh", {})
                session.wait("return document.querySelectorAll('button.ge-select-node-hitbox').length===4")
                restored = session.js("return JSON.parse(localStorage.getItem('graph-editor-graph'))")
                assert restored["nodes"][0]["color"] == "green" and restored["nodes"][0]["x"] == graph["nodes"][0]["x"]
                results.append({"locale": locale, "theme": theme, "requestedWindowWidth": width, "viewport": dimensions, "checks": ["keyboard Enter opens panel", "Tab focus", "Escape and opener restoration", "immediate typing", "import", "node color", "drag", "JSON export data", "PNG preview", "reload persistence", "geometry"]})
                print(f"{prefix} {dimensions}: passed", flush=True)
    return results


def main():
    assert len(sys.argv) == 1, "This runner accepts no URL or command overrides"
    policy_checks()
    OUTPUT.mkdir(exist_ok=True)
    driver = subprocess.Popen(["/usr/bin/safaridriver", "-p", "4447"], stdout=(OUTPUT / "driver.log").open("w"), stderr=subprocess.STDOUT)
    session = None
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
        (OUTPUT / "capabilities.json").write_text(json.dumps(session.capabilities, indent=2))
        results = run(session)
        (OUTPUT / "results.json").write_text(json.dumps({"status": "passed", "capabilities": session.capabilities, "results": results, "limits": ["No first-time human participant", "Native file download not checked; exported JSON saved by test runner"]}, indent=2))
    except Exception as error:
        (OUTPUT / "failure.json").write_text(json.dumps({"status": "failed_or_blocked", "error": str(error)}, indent=2))
        if session:
            try:
                (OUTPUT / "failure-state.json").write_text(json.dumps(session.js("return {trace:window.__focusTrace,active:document.activeElement.tagName,input:document.querySelector('textarea')?.value}"), indent=2))
                session.screenshot("failure")
            except Exception:
                pass
        raise
    finally:
        try:
            if session:
                session.close()
        finally:
            driver.terminate()
            try:
                driver.wait(timeout=5)
            except subprocess.TimeoutExpired:
                driver.kill()
                driver.wait(timeout=5)


if __name__ == "__main__":
    main()
