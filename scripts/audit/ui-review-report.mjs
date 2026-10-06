// Keep original pixels, measured geometry, annotations and comparisons together.
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const input = process.env.INPUT_DIR ?? "/tmp/graph-editor-ui-review";
const output = process.env.OUTPUT_DIR ?? "/tmp/graph-editor-ui-review/report";
const phases = {
  before: [
    "before",
    "before-wide",
    "before-dark",
    "before-locales",
    "before-zh",
    "before-short",
  ],
  after: [
    "after",
    "after-dark",
    "after-locales",
    "after-short",
    "after-mobile",
    "after-dark-mobile",
    "after-locales-mobile",
  ],
};
const maps = {};
for (const [phase, directories] of Object.entries(phases)) {
  const records = new Map();
  for (const directory of directories) {
    let manifest;
    try {
      manifest = JSON.parse(
        await readFile(path.join(input, directory, "manifest.json"), "utf8"),
      );
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    if (manifest.errors.length) throw new Error(`Page errors in ${directory}`);
    for (const record of manifest.results)
      records.set(record.file, {
        ...record,
        source: path.join(input, directory, record.file),
      });
  }
  maps[phase] = records;
  if (!records.size) throw new Error(`No ${phase} screenshots in ${input}`);
  await mkdir(path.join(output, phase), { recursive: true });
  const values = [...records.values()];
  for (let start = 0; start < values.length; start += 32) {
    await Promise.all(
      values
        .slice(start, start + 32)
        .map((record) =>
          copyFile(record.source, path.join(output, phase, record.file)),
        ),
    );
  }
}
const records = [...maps.before.values()].map((record) => {
  const after = maps.after.get(record.file);
  if (!after) throw new Error(`Missing after screenshot: ${record.file}`);
  const { source: _beforeSource, ...before } = record;
  const { source: _afterSource, ...updated } = after;
  return { ...before, before, after: updated };
});
const remaining = records.filter(
  (record) =>
    record.after.offscreen.length ||
    record.after.clipped.length ||
    record.after.horizontalOverflow,
);
if (remaining.length)
  throw new Error(
    `Remaining geometry findings: ${remaining.map((record) => record.file).join(", ")}`,
  );
const names = {
  empty: "初期画面",
  "import-empty": "読み込み・空欄",
  "import-valid": "読み込み・有効な入力",
  "import-invalid": "読み込み・警告",
  samples: "サンプル一覧",
  "samples-search": "サンプル検索",
  "samples-empty": "検索結果なし",
  graph: "グラフ表示",
  "node-selected": "頂点選択",
  "node-edit": "ラベル編集",
  "context-menu": "右クリックメニュー",
  "multi-selected": "複数選択",
  layouts: "配置",
  settings: "設定",
  menu: "モバイルの配置・設定",
  export: "辺リストの書き出し",
  "export-json": "JSON 書き出し",
  "export-tikz": "TikZ 書き出し",
  png: "PNG プレビュー",
  "app-menu": "アプリメニュー",
  shortcuts: "ショートカット",
  "draw-node": "頂点を描く",
  "draw-edge": "辺を描く",
};
const annotations = [
  {
    id: "01",
    title: "読み込みの主操作が画面外",
    file: "ja-light-320x900-import-valid.png",
    width: 320,
    height: 900,
    rect: [304, 842, 16, 48],
    note: "320〜414px幅では、補助操作の右側にある反映ボタンが切れていました。狭い画面では反映を独立した全幅の行に置き、補助操作を上段にまとめました。",
  },
  {
    id: "02",
    title: "最後の色を選べない",
    file: "ja-light-320x900-node-selected.png",
    width: 320,
    height: 900,
    rect: [20, 699, 300, 58],
    note: "320px幅ではカラーパレットが右端を超え、緑を十分に表示できませんでした。44pxの操作領域を保って折り返します。低い画面では選択名をツールバーの読み上げ名に残し、グラフの表示領域を確保します。",
  },
  {
    id: "03",
    title: "警告時の長い文言が切れる",
    file: "ja-light-1440x900-import-invalid.png",
    width: 600,
    height: 540,
    crop: [420, 180],
    rect: [324, 443, 256, 48],
    note: "警告付きの長い確認文は、デスクトップのダイアログでも右端で切れました。補助操作と主操作を折り返せるフッターに変更し、長い文言も収めます。",
  },
  {
    id: "04",
    title: "低い画面で一覧がほとんど見えない",
    file: "ja-light-768x390-samples.png",
    width: 768,
    height: 390,
    rect: [60, 276, 646, 12],
    note: "高さ390pxでは検索条件が一覧の領域を圧迫していました。生成設定を一覧と一緒にスクロールさせ、低いウィンドウではダイアログの上下余白を12pxにします。検索とカテゴリ、閉じる操作、戻る操作は表示を保ちます。",
  },
  {
    id: "05",
    title: "入力欄と警告文の重なりを解消",
    file: "ja-light-320x390-import-invalid.png",
    width: 320,
    height: 390,
    rect: [16, 281, 288, 35],
    note: "低い画面ではグリッドが入力欄より小さくなり、後続の警告文が入力欄に重なりました。入力とプレビューの最小高さを確保し、内容を縦にスクロールして読めるようにしました。",
  },
];
const escape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
const annotationHtml = (annotation) => {
  const [x, y, width, height] = annotation.rect;
  const frame = (phase) =>
    `<figure><figcaption>${phase === "before" ? "改善前" : "改善後"}</figcaption><div class="frame" style="width:${annotation.width}px;height:${annotation.height}px"><img src="${phase}/${annotation.file}" style="${annotation.crop ? `position:absolute;width:1440px;max-width:none;left:-${annotation.crop[0]}px;top:-${annotation.crop[1]}px` : "width:100%;height:100%"}" alt="${escape(annotation.title)} ${phase}">${phase === "before" ? `<div class="outline" style="left:${x}px;top:${y}px;width:${width}px;height:${height}px"></div>` : ""}</div></figure>`;
  return `<!doctype html><html lang="ja"><meta charset="utf-8"><title>${escape(annotation.title)}</title><style>body{margin:0;padding:32px;background:#f5f7fb;color:#15233b;font:16px/1.7 system-ui,-apple-system,sans-serif}h1{font-size:28px;margin:0 0 8px}.note{max-width:1200px;margin:0 0 24px;color:#41516a}.row{display:flex;gap:28px;align-items:flex-start}figure{margin:0}figcaption{font-weight:700;margin-bottom:8px}.frame{position:relative;overflow:hidden;background:white;border:1px solid #d9e1ec;border-radius:12px}.frame img{display:block}.outline{position:absolute;box-sizing:border-box;border:3px solid #d92d42;background:#d92d4210;pointer-events:none}small{display:block;margin-top:20px;color:#63718a}</style><h1>${annotation.id} ${escape(annotation.title)}</h1><p class="note">${escape(annotation.note)}</p><div class="row">${frame("before")}${frame("after")}</div><small>原寸の実画面に座標指定で注釈を重ねています。元のスクリーンショットは変更していません。${annotation.crop ? "ダイアログ部分を切り出して表示。" : ""}</small></html>`;
};
for (const annotation of annotations)
  await writeFile(
    path.join(output, `annotated-${annotation.id}.html`),
    annotationHtml(annotation),
  );
const widths = [...new Set(records.map((record) => record.width))].sort(
  (a, b) => a - b,
);
const states = [...new Set(records.map((record) => record.state))];
let validation = null;
try {
  validation = JSON.parse(
    await readFile(path.join(input, "validation.json"), "utf8"),
  );
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
await writeFile(
  path.join(output, "manifest.json"),
  JSON.stringify(
    { widths, states, screenshots: records.length * 2, records },
    null,
    2,
  ),
);
const markup = `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Graph Editor UIレビュー</title>
<style>*{box-sizing:border-box}body{margin:0;background:#f5f7fb;color:#16243b;font:15px/1.65 system-ui,-apple-system,sans-serif}main{max-width:1600px;margin:auto;padding:32px}h1{font-size:32px;margin:0}h2{margin-top:40px}p{max-width:1000px}.sub{color:#5c6c85}.stats{display:flex;gap:12px;flex-wrap:wrap;margin:24px 0}.stat,.note{background:white;border:1px solid #dfe6f0;border-radius:12px;padding:16px}.stat strong{font-size:25px;display:block}.notes{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}.notes a{font-weight:700;color:#17499c}.filters{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;gap:12px;background:#f5f7bbee;background:#f5f7fbee;padding:16px 0;backdrop-filter:blur(12px)}label{display:grid;gap:4px;font-size:12px}select,button{font:inherit;min-height:40px;background:white;border:1px solid #c6d3e5;border-radius:8px;padding:6px 12px;color:#16243b}button{cursor:pointer}.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px}.pair{padding:14px;background:white;border:1px solid #dfe6f0;border-radius:12px}.pair h3{font-size:15px;margin:0}.pair p{margin:4px 0 12px;font-size:12px;color:#5c6c85}.images{display:grid;grid-template-columns:1fr 1fr;gap:10px}.images a{color:#465b7c;text-decoration:none;font-size:12px}.images img{width:100%;height:300px;object-fit:contain;object-position:top;background:#eef2f7;display:block;margin-top:6px}.empty{padding:24px;color:#5c6c85}.coverage{max-width:100%;overflow:auto}table{border-collapse:collapse;width:100%;font-size:12px}td,th{border:1px solid #dfe6f0;padding:8px;text-align:left}th{background:white}.ok{color:#12653e}details summary{cursor:pointer}.checks{white-space:pre-wrap}a:focus-visible,select:focus-visible,button:focus-visible{outline:3px solid #2865c8;outline-offset:3px}@media(max-width:500px){main{padding:16px}.gallery{grid-template-columns:1fr}h1{font-size:26px}.images img{height:240px}}</style>
<main><h1>Graph Editor UIレビュー</h1><p class="sub">2026年10月5日 · ローカル実画面の変更前後比較</p><p>初期画面から読み込み、編集、サンプル検索、各パネル、書き出しまでを隔離したChromiumで撮影しました。幅と状態、テーマ、言語を選び、画像をクリックすると原寸で確認できます。</p>
<div class="stats"><div class="stat"><strong>${records.length * 2}枚</strong>変更前後のスクリーンショット</div><div class="stat"><strong>${widths.length}幅</strong>320〜2560 CSS px</div><div class="stat"><strong>${states.length}状態</strong>3言語・2テーマ・2高さ</div><div class="stat"><strong class="ok">0件</strong>修正後の検査対象のはみ出し</div></div>
<h2>注釈と改善内容</h2><p>注釈は元の実画面に座標指定で重ねたものです。各リンクで問題箇所と改善後を並べて確認できます。</p><div class="notes">${annotations.map((annotation) => `<article class="note"><a href="annotated-${annotation.id}.html">${annotation.id} ${escape(annotation.title)}</a><p>${escape(annotation.note)}</p><a href="annotated-${annotation.id}.png">注釈付きPNG</a></article>`).join("")}</div>
<h2>画面ギャラリー</h2><div class="filters"><label>画面の状態<select id="state">${states.map((state) => `<option value="${state}">${names[state] ?? state}</option>`).join("")}</select></label><label>横幅<select id="width"><option value="all">すべて</option>${widths.map((width) => `<option>${width}</option>`).join("")}</select></label><label>テーマ<select id="theme"><option value="all">すべて</option><option>light</option><option>dark</option></select></label><label>言語<select id="locale"><option value="all">すべて</option><option>ja</option><option>en</option><option>zh-Hans</option></select></label><label>高さ<select id="height"><option value="all">すべて</option><option>900</option><option>390</option></select></label><button id="reset">条件を戻す</button></div><p id="count" class="sub"></p><div id="gallery" class="gallery"></div>
<h2>撮影範囲と検証の範囲</h2><p>17種類の幅は ${widths.join(", ")}px。通常高さは900px、低い画面は390pxです。日本語・ライトでは16幅の全状態を撮影。ダークは320・375・768・1280px、英語・中国語は375・768・1280px、低い画面は320・667・768・1280pxを撮影しました。全軸の全組み合わせを撮影したわけではありません。</p><p>別途、3言語×2テーマ×5幅で、実際の読み込み・クリック・色の保存・Home/Endキー・フォーカス復帰・低い画面でのサンプル作成を検証しています。撮影幅の間は16px刻みと切替境界の追加幅でレイアウトを検証します。</p><p>画面外へのはみ出し、パネル内と選択ツールバー内の横方向のクリッピング、ページ全体の横スクロールを検査します。全画像の全要素が自動検証されるわけではなく、実機のソフトウェアキーボード、Safari/Firefox、全79サンプルの全パラメーター組み合わせはこの撮影の対象外です。</p>
<details><summary>条件ごとの撮影数</summary><div class="coverage"><table><thead><tr><th>言語</th><th>テーマ</th><th>幅×高さ</th><th>状態数</th></tr></thead><tbody id="coverage"></tbody></table></div></details><p><a href="manifest.json">撮影・検査データ（JSON）</a> · <a href="width-sweep.json">連続幅の検査データ</a> · <a href="validation.json">検証結果</a></p><pre id="checks" class="checks sub">${validation ? escape(JSON.stringify(validation, null, 2)) : ""}</pre></main>
<script>const DATA=${JSON.stringify(records)};const NAMES=${JSON.stringify(names)};const ids=['state','width','theme','locale','height'];const controls=ids.map(id=>document.getElementById(id));function render(){const values=Object.fromEntries(controls.map(control=>[control.id,control.value]));const matches=DATA.filter(record=>ids.every(id=>values[id]==='all'||String(record[id])===values[id]));document.getElementById('count').textContent=matches.length+'条件・'+matches.length*2+'枚';const gallery=document.getElementById('gallery');gallery.replaceChildren();for(const record of matches){const article=document.createElement('article');article.className='pair';const h=document.createElement('h3');h.textContent=NAMES[record.state]||record.state;const p=document.createElement('p');p.textContent=record.locale+' / '+record.theme+' / '+record.width+' × '+record.height+' / '+record.after.layout;const images=document.createElement('div');images.className='images';for(const phase of ['before','after']){const a=document.createElement('a');a.href=phase+'/'+record.file;a.target='_blank';a.textContent=phase==='before'?'改善前':'改善後';const img=document.createElement('img');img.src=a.href;img.loading='lazy';img.alt=p.textContent+' '+h.textContent+' '+a.textContent;a.append(img);images.append(a)}article.append(h,p,images);gallery.append(article)}}controls.forEach(control=>control.addEventListener('change',render));document.getElementById('reset').addEventListener('click',()=>{controls.forEach(control=>control.value=control.id==='state'?'empty':'all');render()});const groups=new Map();DATA.forEach(record=>{const key=record.locale+'|'+record.theme+'|'+record.width+' × '+record.height;groups.set(key,(groups.get(key)||0)+1)});for(const [key,count] of groups){const row=document.createElement('tr');for(const value of [...key.split('|'),count]){const cell=document.createElement('td');cell.textContent=value;row.append(cell)}document.getElementById('coverage').append(row)}render();</script></html>`;
await writeFile(path.join(output, "index.html"), markup);
for (const file of ["width-sweep.json", "validation.json"]) {
  try {
    await copyFile(path.join(input, file), path.join(output, file));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
if (process.env.RENDER_ANNOTATIONS === "1") {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    for (const annotation of annotations) {
      await page.setViewportSize({
        width: annotation.width * 2 + 92,
        height: annotation.height + 250,
      });
      await page.goto(
        pathToFileURL(path.join(output, `annotated-${annotation.id}.html`))
          .href,
      );
      await page.evaluate(() =>
        Promise.all([...document.images].map((image) => image.decode())),
      );
      await page.screenshot({
        path: path.join(output, `annotated-${annotation.id}.png`),
        fullPage: true,
      });
    }
  } finally {
    await browser.close();
  }
}
console.log(
  JSON.stringify(
    {
      output,
      screenshots: records.length * 2,
      widths,
      states: states.length,
      remainingFindings: remaining.length,
    },
    null,
    2,
  ),
);
