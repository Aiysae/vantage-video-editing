/* media.js —— 真实素材（录屏 / 截图 / 视频）的展示层。依赖 GSAP、kit.js（MU）、icons.js。
 * 组件：
 *   MU.media.window(parent, o)   带标题栏的媒体小窗（浏览器/应用窗口外观），返回 {el, view, zoom}
 *   MU.media.video(view, o)      在窗口里放一段视频（HyperFrames 时间轴管理播放；窗口本身不能带 data-start）
 *   MU.media.image(view, o)      在窗口里放截图（可慢速滚动长截图）
 *   MU.media.cursor(tl, zoom, rec, o)    按录屏 events.json 叠加放大光标 + 点击波纹（Claude 录屏时记录的真实轨迹）
 *   MU.media.autoZoom(tl, zoom, keys, o) 跟随点击推近 / 平移 / 拉回（Screen Studio 式）
 *   MU.media.steps(parent, o) + stepsSync(tl, list, rec, o)  与录屏步骤同步的清单：已完成 ✓ / 当前高亮 / 未到暗
 *   MU.media.progress(parent, o) 顶部分段章节进度条（当前段高亮）
 * 时间换算：comp 时间 = o.at + (rec 时间 - o.mediaStart)。
 */
(function () {
  const M = (window.MU = window.MU || {});
  const el = (t, c, p, h, s) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; if (s) Object.assign(e.style, s); if (p) p.appendChild(e); return e; };
  const px = (v) => (typeof v === "number" ? v + "px" : v);
  const css = `
  .mm-win{position:absolute;box-sizing:border-box;border-radius:18px;overflow:hidden;background:#0f1012;border:1px solid rgba(255,255,255,.12);
    box-shadow:0 30px 90px rgba(0,0,0,.65),0 0 0 1px rgba(0,0,0,.4);transform-origin:50% 50%}
  .mm-bar{height:44px;display:flex;align-items:center;gap:10px;padding:0 14px;background:#1b1c1f;border-bottom:1px solid rgba(255,255,255,.08);font:500 22px var(--f-ui,sans-serif);color:#b9bcc3}
  .mm-bar i{width:11px;height:11px;border-radius:50%;background:#3a3c42;flex:none}
  .mm-url{flex:1;display:flex;align-items:center;gap:8px;margin-left:8px;height:28px;padding:0 12px;border-radius:8px;background:#0f1012;white-space:nowrap;overflow:hidden}
  .mm-url svg{width:16px;height:16px;flex:none}
  .mm-src{position:absolute;right:12px;bottom:10px;padding:3px 9px;border-radius:999px;background:rgba(0,0,0,.6);color:#d8dbe0;font:600 20px var(--f-ui,sans-serif);letter-spacing:.04em;z-index:9}
  .mm-view{position:absolute;left:0;right:0;bottom:0;overflow:hidden;background:#fff}
  .mm-zoom{position:absolute;left:0;top:0;transform-origin:0 0}
  .mm-zoom video,.mm-zoom img{position:absolute;left:0;top:0;width:100%;display:block}
  .mm-cur{position:absolute;left:0;top:0;width:34px;height:34px;z-index:5;pointer-events:none;filter:drop-shadow(0 3px 6px rgba(0,0,0,.45))}
  .mm-rip{position:absolute;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:50%;border:3px solid #66d4f2;z-index:4;opacity:0}
  .mm-steps{position:absolute;display:flex;flex-direction:column;gap:10px}
  .mm-step{display:flex;align-items:center;gap:12px;padding:10px 16px;border-radius:14px;background:rgba(18,19,22,.82);border:1px solid rgba(255,255,255,.08);
    color:#8a8d95;font:700 38px var(--f-ui,sans-serif);transform-origin:0 50%}
  .mm-step b{font:900 26px var(--f-display,sans-serif);width:48px;height:48px;border-radius:50%;display:grid;place-items:center;border:2px solid currentColor}
  .mm-step .tag{margin-left:auto;font-size:28px;padding:2px 10px;border-radius:999px;background:#66d4f2;color:#0d1418;opacity:0}
  .mm-prog{position:absolute;left:0;right:0;top:0;height:48px;display:flex;gap:2px;font:600 28px var(--f-ui,sans-serif)}
  .mm-prog div{flex:1;display:grid;place-items:center;color:#b9bcc3;background:rgba(255,255,255,.12)}
  .mm-prog div.on{background:#f2f3f5;color:#111}`;
  if (!document.getElementById("mm-css")) { const s = el("style", null, document.head, css); s.id = "mm-css"; }

  const media = {};
  media.window = function (parent, o) {
    const w = el("div", "mm-win", parent, null, { left: px(o.x), top: px(o.y), width: px(o.w), height: px(o.h) });
    const bar = el("div", "mm-bar", w, "<i></i><i></i><i></i>");
    const icon = o.brand && window.MU_ICONS ? window.MU_ICONS.brands[o.brand]?.svg.replace("<svg ", '<svg fill="#e9ecf1" ') || "" : "";
    if (o.url || o.title) el("div", "mm-url", bar, icon + (o.url || o.title));
    const view = el("div", "mm-view", w, null, { top: "44px" });
    const zoom = el("div", "mm-zoom", view, null, { width: "100%", height: "100%" });
    if (o.source) el("div", "mm-src", w, o.source);
    return { el: w, view, zoom, w: o.w, h: o.h - 44 };
  };
  // 推荐：在 HTML 里静态写好 <video id=... class="clip" data-start data-duration data-media-start muted playsinline>（便于渲染器预抽帧），这里传 o.el 移入窗口
  media.video = function (win, o) {
    if (o.el) { win.zoom.appendChild(o.el); Object.assign(o.el.style, { position: "absolute", left: 0, top: 0, width: "100%" }); return o.el; }
    const v = el("video", "clip", win.zoom); v.src = o.src; v.muted = true; v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
    v.id = o.id; v.dataset.start = o.at; v.dataset.duration = o.dur; v.dataset.mediaStart = o.mediaStart || 0; v.dataset.trackIndex = o.track || 3;
    return v;
  };
  media.image = function (win, o) { const i = el("img", null, win.zoom); i.src = o.src; return i; };
  // 光标与点击：rec = events.json；o = {at, mediaStart, until, scale}
  media.cursor = function (tl, win, rec, o) {
    const s = o.scale || win.w / rec.viewport[0], toComp = (t) => o.at + (t - (o.mediaStart || 0));
    const c = el("div", "mm-cur", win.zoom, '<svg viewBox="0 0 24 24"><path d="M4 2 L4 19 L8.6 14.8 L11.6 21.6 L14.6 20.3 L11.7 13.6 L18 13.6 Z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>');
    const evs = rec.events.filter((e) => e.x != null && toComp(e.t) <= (o.until ?? 1e9));
    const first = evs.find((e) => toComp(e.t) >= o.at) || evs[0];
    if (!first) return c;
    gsap.set(c, { x: first.x * s, y: first.y * s, autoAlpha: 0 }); tl.to(c, { autoAlpha: 1, duration: 0.2 }, o.at + 0.1);
    let last = toComp(first.t);
    evs.forEach((e, i) => {
      const t = toComp(e.t); if (t < o.at || (e.type === "move" && i % 3 !== 0)) return;
      tl.to(c, { x: e.x * s, y: e.y * s, duration: Math.max(0.01, t - last), ease: "none" }, last); last = t;
      if (e.type === "click") {
        tl.to(c, { scale: 0.82, duration: 0.08, yoyo: true, repeat: 1, transformOrigin: "10% 8%" }, t);
        const r = el("div", "mm-rip", win.zoom, null, { left: px(e.x * s), top: px(e.y * s) });
        tl.fromTo(r, { scale: 0.4, opacity: 0.95 }, { scale: 3.2, opacity: 0, duration: 0.55, ease: "power2.out" }, t);
      }
    });
    return c;
  };
  // 自动推近：keys = [{t, dur, x, y, s}]，x/y 为录屏视口坐标（推近中心）；s=1 回到全景
  media.autoZoom = function (tl, win, rec, keys, o = {}) {
    const k0 = win.w / rec.viewport[0];
    const pose = (k) => { const s = k.s || 1; if (s === 1) return { x: 0, y: 0, scale: 1 };
      const cx = k.x * k0, cy = k.y * k0; return { x: Math.min(0, Math.max(win.w - win.w * s, win.w / 2 - cx * s)), y: Math.min(0, Math.max(win.h - win.h * s, win.h / 2 - cy * s)), scale: s }; };
    gsap.set(win.zoom, { x: 0, y: 0, scale: 1 });
    keys.forEach((k) => tl.to(win.zoom, Object.assign(pose(k), { duration: k.dur || 0.7, ease: k.ease || "power3.inOut" }), k.t));
  };
  // 步骤清单
  media.steps = function (parent, o) {
    const box = el("div", "mm-steps", parent, null, { left: px(o.x), top: px(o.y) });
    box.items = o.items.map((t, i) => { const r = el("div", "mm-step", box, `<b><span class="n">${String(i + 1).padStart(2, "0")}</span><span class="ok" style="position:absolute;opacity:0">✓</span></b><span>${t}</span><span class="tag">${o.tags?.[i] || "进行中"}</span>`); r.num = r.querySelector(".n"); r.ok = r.querySelector(".ok"); r.querySelector("b").style.position = "relative"; r.tag = r.querySelector(".tag"); return r; });
    return box;
  };
  media.stepsSync = function (tl, box, rec, o) {
    const toComp = (t) => o.at + (t - (o.mediaStart || 0));
    const marks = rec.events.filter((e) => e.type === "step").map((e) => Math.max(o.from ?? o.at, toComp(e.t)));
    box.items.forEach((it, i) => {
      const t = marks[i]; if (t == null) return;
      tl.to(it, { color: "#f2f3f5", borderColor: "rgba(102,212,242,.9)", backgroundColor: "rgba(18,30,36,.92)", scale: 1.04, duration: 0.25 }, t);
      tl.to(it.tag, { opacity: 1, duration: 0.2 }, t);
      const end = marks[i + 1];
      if (end != null) { tl.to(it, { color: "#9a9da5", borderColor: "rgba(255,255,255,.08)", backgroundColor: "rgba(18,19,22,.82)", scale: 1, duration: 0.25 }, end);
        tl.to(it.tag, { opacity: 0, duration: 0.15 }, end); tl.to(it.num, { opacity: 0, duration: 0.15 }, end); tl.to(it.ok, { opacity: 1, color: "#66d4f2", duration: 0.15 }, end); }
    });
  };
  media.progress = function (parent, o) {
    const bar = el("div", "mm-prog", parent, null, o.style || {});
    bar.segs = o.items.map((t, i) => el("div", i === o.active ? "on" : "", bar, t, { flex: o.weights?.[i] || 1 }));
    return bar;
  };
  M.media = media;
})();
