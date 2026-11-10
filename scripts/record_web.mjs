#!/usr/bin/env node
// 网页工具录屏：Claude 用无头浏览器按动作脚本真实操作网页，只录网页视口（不会录到桌面其他内容）。
// 输出：<out>/screen.mp4（恒定 30fps）、<out>/events.json（光标轨迹/点击/步骤，供后期叠加放大光标、点击波纹、自动推近）、<out>/shot-*.png
// 用法：node record_web.mjs actions.json <out_dir>
// actions.json: {"viewport":[1440,900],"scale":2,"steps":[
//   {"do":"goto","url":"https://..."}, {"do":"wait","ms":800},
//   {"do":"step","label":"打开仓库"},                       // 步骤标记（对应画面左侧步骤清单）
//   {"do":"scroll","y":600,"ms":1400}, {"do":"move","selector":"...","ms":700},
//   {"do":"click","selector":"..."}, {"do":"type","selector":"...","text":"...","cps":12},
//   {"do":"key","key":"Enter"}, {"do":"shot","name":"readme","fullPage":false}]}
// 需要登录的网站：不由 Claude 输入密码。用户先在浏览器登录，再用 --user-data-dir 复用登录态（见 references/assets.md）。
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function findPuppeteer() {
  const home = process.env.HOME, base = path.join(home, ".npm/_npx");
  for (const d of fs.existsSync(base) ? fs.readdirSync(base) : []) {
    const p = path.join(base, d, "node_modules/puppeteer-core");
    if (fs.existsSync(p)) return p;
  }
  return "puppeteer-core";
}
function findChrome() {
  const base = path.join(process.env.HOME, ".cache/hyperframes/chrome/chrome-headless-shell");
  if (fs.existsSync(base)) for (const v of fs.readdirSync(base)) {
    const p = path.join(base, v, "chrome-headless-shell-mac-arm64/chrome-headless-shell"); if (fs.existsSync(p)) return p;
  }
  return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
}
const puppeteer = require(findPuppeteer());
const [, , actFile, outDir, ...rest] = process.argv;
const userDataDir = (rest.find((a) => a.startsWith("--user-data-dir=")) || "").split("=")[1];
const spec = JSON.parse(fs.readFileSync(actFile, "utf8"));
const [VW, VH] = spec.viewport || [1440, 900], SCALE = spec.scale || 2;
fs.mkdirSync(path.join(outDir, "frames"), { recursive: true });

const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, userDataDir,
  args: ["--hide-scrollbars", "--lang=zh-CN", `--window-size=${VW},${VH}`] });
const page = await browser.newPage();
await page.setViewport({ width: VW, height: VH, deviceScaleFactor: SCALE });
const cdp = await page.createCDPSession();
const frames = []; let t0 = null; let n = 0;
cdp.on("Page.screencastFrame", async (f) => {
  const ts = f.metadata.timestamp; if (t0 === null) t0 = ts;
  const file = path.join(outDir, "frames", `f${String(n++).padStart(6, "0")}.jpg`);
  fs.writeFileSync(file, Buffer.from(f.data, "base64")); frames.push({ file, t: ts - t0 });
  await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
});
const events = []; const now = () => Date.now() / 1000 - wall0;
let wall0 = 0, cur = { x: VW * 0.6, y: VH * 0.55 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function center(sel) {
  const el = await page.waitForSelector(sel, { visible: true, timeout: 15000 });
  await el.scrollIntoView().catch(() => {}); await sleep(250);
  const b = await el.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height };
}
async function moveTo(p, ms = 700) {  // 缓动移动并记录轨迹
  const steps = Math.max(8, Math.round(ms / 16)), a = { ...cur };
  for (let i = 1; i <= steps; i++) {
    const k = i / steps, e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    cur = { x: a.x + (p.x - a.x) * e, y: a.y + (p.y - a.y) * e };
    await page.mouse.move(cur.x, cur.y); events.push({ t: now(), type: "move", x: cur.x, y: cur.y }); await sleep(ms / steps);
  }
}
// 首个 goto 在开录前完成，避免录到加载白屏
const steps = [...spec.steps];
if (steps[0]?.do === "goto") { await page.goto(steps.shift().url, { waitUntil: "networkidle2", timeout: 60000 }); await sleep(600); }
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, everyNthFrame: 1, maxWidth: VW * SCALE, maxHeight: VH * SCALE });
wall0 = Date.now() / 1000;
for (const s of steps) {
  if (s.do === "goto") { await page.goto(s.url, { waitUntil: "networkidle2", timeout: 60000 }); events.push({ t: now(), type: "goto", url: s.url }); }
  else if (s.do === "wait") await sleep(s.ms || 800);
  else if (s.do === "step") events.push({ t: now(), type: "step", label: s.label });
  else if (s.do === "scroll") {
    const steps = Math.round((s.ms || 1200) / 16);
    for (let i = 0; i < steps; i++) { await page.mouse.wheel({ deltaY: s.y / steps }); await sleep(16); }
    events.push({ t: now(), type: "scroll", dy: s.y });
  } else if (s.do === "move") { const p = await center(s.selector); await moveTo(p, s.ms); }
  else if (s.do === "click") {
    const p = await center(s.selector); await moveTo(p, s.ms || 650); await sleep(120);
    events.push({ t: now(), type: "click", x: p.x, y: p.y, w: p.w, h: p.h, label: s.label || "" });
    await page.mouse.click(p.x, p.y); await sleep(s.after || 500);
  } else if (s.do === "type") {
    if (s.selector) { const p = await center(s.selector); await moveTo(p, 500); await page.mouse.click(p.x, p.y); events.push({ t: now(), type: "click", x: p.x, y: p.y }); }
    events.push({ t: now(), type: "type", text: s.text, x: cur.x, y: cur.y });
    await page.keyboard.type(s.text, { delay: 1000 / (s.cps || 12) });
  } else if (s.do === "key") await page.keyboard.press(s.key);
  else if (s.do === "shot") await page.screenshot({ path: path.join(outDir, `shot-${s.name}.png`), fullPage: !!s.fullPage });
}
await sleep(400);
await cdp.send("Page.stopScreencast");
const total = now();
await browser.close();
// 变帧率截帧 → 恒定 30fps
const list = frames.map((f, i) => `file '${f.file}'\nduration ${((frames[i + 1]?.t ?? total) - f.t).toFixed(4)}`).join("\n") + `\nfile '${frames.at(-1).file}'\n`;
fs.writeFileSync(path.join(outDir, "frames.txt"), list);
execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", path.join(outDir, "frames.txt"), "-vf", "fps=30,format=yuv420p,scale=trunc(iw/2)*2:trunc(ih/2)*2",
  "-c:v", "libx264", "-crf", "16", "-preset", "slow", path.join(outDir, "screen.mp4")]);
fs.writeFileSync(path.join(outDir, "events.json"), JSON.stringify({ viewport: [VW, VH], scale: SCALE, duration: total, events }, null, 1));
fs.rmSync(path.join(outDir, "frames"), { recursive: true, force: true }); fs.rmSync(path.join(outDir, "frames.txt"));
console.log(`recorded ${frames.length} frames, ${total.toFixed(2)}s -> ${path.join(outDir, "screen.mp4")}`);
