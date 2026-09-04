// UI audit: target sizes, text contrast, chrome overlaps and off-screen panels
// across viewport widths and every panel. Usage:
//   bun scripts/audit/ui-audit.mjs            (dev server on :3000)
//   THEME=dark BASE_URL=http://localhost:3000 bun scripts/audit/ui-audit.mjs
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const AUDIT = `(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const main = document.querySelector("main");
  const findings = [];
  const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const parse = (s) => { const c = document.createElement("canvas").getContext("2d"); c.fillStyle = "#000"; c.fillStyle = s; c.fillRect(0,0,1,1); return [...c.getImageData(0,0,1,1).data]; };
  const bgOf = (el) => { let e = el; while (e && e !== document.body) { const p = parse(getComputedStyle(e).backgroundColor); if (p[3] > 200) return p.slice(0,3); e = e.parentElement; } return parse(getComputedStyle(document.body).backgroundColor).slice(0,3); };
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && el.offsetParent !== null && getComputedStyle(el).visibility !== "hidden"; };
  const rects = (els) => els.map((el) => ({ el, r: el.getBoundingClientRect() }));
  const overlap = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  const label = (el) => (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 24);
  const scan = (state) => {
    const touch = main.dataset.layout === "mobile";
    const minSize = touch ? 44 : 30;
    const M = main.getBoundingClientRect();
    const interactive = [...main.querySelectorAll("button,input,select,textarea,a[href],[role=radio],[role=checkbox],[role=switch],[role=menuitem]")].filter(visible);
    for (const el of interactive) {
      const r = el.getBoundingClientRect();
      if (el.tagName !== "TEXTAREA" && (Math.round(r.width) < minSize || Math.round(r.height) < minSize) && !el.closest("[data-edge-node-hitbox],[class*=cursor-grab],[class*=cursor-text]"))
        findings.push(state + ": target too small " + label(el) + " " + Math.round(r.width) + "x" + Math.round(r.height));
      if (!el.getAttribute("aria-label") && !el.textContent.trim() && !["INPUT","SELECT","TEXTAREA"].includes(el.tagName))
        findings.push(state + ": unlabeled control " + el.tagName);
    }
    const texts = [...main.querySelectorAll("span,p,h2,kbd,button,a,label,div,output,legend")].filter((el) => visible(el) && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1) && !el.closest("[data-edge-node-hitbox]"));
    for (const el of texts) {
      const cs = getComputedStyle(el); const fg = parse(cs.color).slice(0,3); const bg = bgOf(el);
      const l1 = lum(fg), l2 = lum(bg); const cr = (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);
      const size = parseFloat(cs.fontSize); const bold = parseInt(cs.fontWeight) >= 700;
      const large = size >= 24 || (size >= 18.66 && bold);
      if (!el.closest("[disabled],[aria-disabled='true']") && cr < (large ? 3 : 4.5)) findings.push(state + ": low contrast " + cr.toFixed(2) + ' "' + label(el) + '" ' + size + "px");
    }
    const panels = rects([...main.querySelectorAll(".ge-panel,[data-editor-panel]")].filter(visible));
    const modal = (el) => el.closest("[aria-modal='true'],.ge-sheet") !== null;
    for (let i = 0; i < panels.length; i++) for (let j = i + 1; j < panels.length; j++) {
      if (panels[i].el.contains(panels[j].el) || panels[j].el.contains(panels[i].el)) continue;
      if (modal(panels[i].el) || modal(panels[j].el)) continue;
      if (overlap(panels[i].r, panels[j].r)) findings.push(state + ": overlap " + label(panels[i].el) + " x " + label(panels[j].el));
    }
    for (const { el, r } of panels) if (r.right > M.right + 1 || r.left < M.left - 1 || r.bottom > M.bottom + 1 || r.top < M.top - 1) findings.push(state + ": off-screen " + label(el) + " [" + [r.left, r.top, r.right, r.bottom].map(Math.round).join(",") + "]");
  };
  const openPanel = async (name) => { const b = document.querySelector('button[aria-label="' + name + '"]'); if (!b) return false; b.click(); await wait(400); return true; };
  const close = async () => { document.querySelector('[aria-label="閉じる"]')?.click(); await wait(250); };
  const w = innerWidth; const mobile = main.dataset.layout === "mobile";
  scan(w + " " + main.dataset.layout + " base");
  const node = main.querySelector("[class*=cursor-grab]"); if (node) { node.click(); await wait(300); scan(w + " selected"); document.body.click(); await wait(100); }
  const panelsToOpen = mobile ? ["メニュー", "書き出し", "PNG 画像", "グラフを読み込む", "アプリメニューを開く"] : ["配置", "設定", "書き出し", "PNG 画像", "グラフを読み込む", "アプリメニューを開く"];
  for (const p of panelsToOpen) { if (await openPanel(p)) { await wait(p === "PNG 画像" ? 1200 : 0); scan(w + " " + p); await close(); } }
  return [w + " " + main.dataset.layout + " theme=" + document.documentElement.dataset.theme + " nodes=" + main.querySelectorAll("[class*=cursor-grab]").length + " panels=" + main.querySelectorAll(".ge-panel").length, ...new Set(findings)];
})()`;
const browser = await chromium.launch();
const all = [];
for (const width of [375, 414, 600, 768, 900, 1100, 1280, 1440, 1920]) {
  const ctx = await browser.newContext({
    viewport: { width, height: 900 },
    locale: "ja-JP",
    colorScheme: process.env.THEME === "dark" ? "dark" : "light",
  });
  if (process.env.THEME)
    await ctx.addInitScript(
      (t) => localStorage.setItem("graph-editor-theme", t),
      process.env.THEME,
    );
  const page = await ctx.newPage();
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  // load a sample so selection / layouts have content
  const sample = page.getByRole("button", { name: /Cycle/ });
  if (await sample.count()) {
    await sample.first().click();
    await page.waitForTimeout(800);
  }
  const res = await page.evaluate(AUDIT);
  all.push(...res);
  await ctx.close();
}
await browser.close();
const findings = all.filter((line) => !/ nodes=\d+ panels=\d+$/.test(line));
console.log(JSON.stringify(all, null, 1));
if (findings.length > 0) {
  console.error(`${findings.length} UI audit finding(s)`);
  process.exit(1);
}
