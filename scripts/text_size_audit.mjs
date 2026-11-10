#!/usr/bin/env node
// 文字可读性检查：在若干时间点 seek 合成，找出“画面上可见、但实际渲染字号低于下限”的文字。
// 下限（2026-10-04 用户反馈小标题看不清后设定，见 design/tokens.json）：16:9 ≥ 32px，9:16 ≥ 30px；标题类 ≥ 40px。
// 实际字号 = computed font-size × 祖先累计缩放（按 getBoundingClientRect 推算），所以缩小后的 HUD 也会被抓出来。
// 豁免：带 data-layout-ignore（背景纹理）或 data-text-decor（纯装饰小字，如英文角标）的元素及其子元素。
// 用法：node text_size_audit.mjs <项目目录/index.html> [--every 0.5] [--min 32]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const find = (sub) => { const b = path.join(process.env.HOME, ".npm/_npx"); for (const d of fs.existsSync(b) ? fs.readdirSync(b) : []) { const p = path.join(b, d, "node_modules", sub); if (fs.existsSync(p)) return p; } return sub; };
const puppeteer = require(find("puppeteer-core"));
const chromeBase = path.join(process.env.HOME, ".cache/hyperframes/chrome/chrome-headless-shell");
const exe = process.env.CHROME_PATH || path.join(chromeBase, fs.readdirSync(chromeBase)[0], "chrome-headless-shell-mac-arm64/chrome-headless-shell");
const file = path.resolve(process.argv[2]);
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? Number(process.argv[i + 1]) : d; };
const every = arg("--every", 0.5);
const html = fs.readFileSync(file, "utf8");
const W = Number((html.match(/data-width="(\d+)"/) || [])[1] || 1920), H = Number((html.match(/data-height="(\d+)"/) || [])[1] || 1080);
const DUR = Number((html.match(/data-composition-id="[^"]+"[^>]*data-duration="([\d.]+)"/) || html.match(/data-duration="([\d.]+)"/) || [])[1] || 10);
const MIN = arg("--min", W > H ? 32 : 30);
const b = await puppeteer.launch({ executablePath: exe, headless: true, args: ["--allow-file-access-from-files", "--autoplay-policy=no-user-gesture-required"] });
const p = await b.newPage(); await p.setViewport({ width: W, height: H });
await p.evaluateOnNewDocument(() => { window.__timelines = window.__timelines || {}; });
await p.goto("file://" + file, { waitUntil: "networkidle0", timeout: 60000 });
await p.evaluate(() => document.fonts && document.fonts.ready);
await new Promise((r) => setTimeout(r, 800));
const hits = new Map();
for (let t = 0; t <= DUR + 1e-6; t += every) {
  const res = await p.evaluate((t, MIN, W, H) => {
    const tl = Object.values(window.__timelines || {})[0]; if (!tl) return { err: "no timeline" };
    tl.seek(t, false);
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    while (walker.nextNode()) {
      const n = walker.currentNode; const txt = n.textContent.trim(); if (!txt || txt.length < 1) continue;
      const el = n.parentElement; if (!el || seen.has(el)) continue; seen.add(el);
      if (el.closest("[data-layout-ignore],[data-text-decor],script,style,template")) continue;
      // 可见性：祖先 opacity 连乘、visibility、在画面内
      let op = 1, vis = true; for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); op *= Number(cs.opacity); if (cs.visibility === "hidden" || cs.display === "none") vis = false; }
      if (!vis || op < 0.15) continue;
      const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || r.right < 0 || r.bottom < 0 || r.left > W || r.top > H) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize); const scale = el.offsetHeight ? r.height / el.offsetHeight : 1;
      const eff = fs * (isFinite(scale) && scale > 0 ? scale : 1);
      if (eff < MIN) out.push({ text: txt.slice(0, 24), px: Math.round(eff * 10) / 10, cls: el.className.toString().slice(0, 40) });
    }
    return { out };
  }, t, MIN, W, H);
  if (res.err) { console.log(res.err); break; }
  for (const o of res.out) { const k = o.text + "|" + o.cls; const h = hits.get(k) || { ...o, times: [] }; h.times.push(Math.round(t * 10) / 10); h.px = Math.min(h.px, o.px); hits.set(k, h); }
}
await b.close();
const list = [...hits.values()].sort((a, b) => a.px - b.px);
console.log(`画幅 ${W}x${H}，下限 ${MIN}px，检查 0–${DUR}s 每 ${every}s`);
if (!list.length) console.log("✓ 没有低于下限的可见文字");
else { console.log(`✗ ${list.length} 处文字低于下限：`); for (const h of list) console.log(`  ${h.px}px  「${h.text}」 .${h.cls}  t=${h.times.slice(0, 4).join(",")}${h.times.length > 4 ? "…" : ""}`); process.exitCode = 1; }
