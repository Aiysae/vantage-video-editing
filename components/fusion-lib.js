/* fusion-lib.js —— 主路线（真人融合）通用工具层：场景显隐、融合进出、人物让位头像气泡、图标卡、章节导航、keep 模式字幕。
 * 页面需提供：#livewrap #bgworld #personwrap>#personinner #hud #navl #l5；window.SUBS=[[in,out,cn,en],...]；window.CHAPTERS=[章节名...]。
 * 首次在 2026-10-03《买的是AI，还是安心》中使用。 */
(function () {
  const L = {};
  L.init = function (tl) {
    const $ = (id) => document.getElementById(id);
    L.tl = tl; L.$ = $;
    L.lw = $("livewrap"); L.pw = $("personwrap"); L.pin = $("personinner"); L.bgw = $("bgworld");
    L.sfx = window.__SFX = [];
    tl.set(L.bgw, { clipPath: "circle(0% at 50% 36%)" }, 0);
    tl.set(L.pw, { opacity: 0 }, 0);
  };
  L.T = (i) => SUBS[i - 1][0];
  L.TE = (i) => SUBS[i - 1][1];
  L.s = (t, cat, o = {}) => { L.sfx.push(Object.assign({ t: +t.toFixed(3), cat }, o)); };

  // 场景容器：只在 [a,b) 可见
  L.scene = function (layer, a, b, cls) {
    const d = MU.el("div", "scn" + (cls ? " " + cls : ""), L.$(layer));
    Object.assign(d.style, { position: "absolute", inset: "0" });
    L.tl.set(d, { autoAlpha: 0 }, 0); L.tl.set(d, { autoAlpha: 1 }, a); L.tl.set(d, { autoAlpha: 0 }, b);
    return d;
  };
  // 元素在 a 入场、b 退场
  L.show = function (e, a, b, o = {}) {
    L.tl.set(e, { autoAlpha: 0 }, 0);
    MU.A.in(L.tl, e, a, o);
    if (b != null) MU.A.out(L.tl, e, b - 0.3);
  };
  L.pop = function (e, a, o = {}) {
    L.tl.fromTo(e, { autoAlpha: 0, scale: o.from || 0.5 }, { autoAlpha: 1, scale: 1, duration: o.dur || 0.45, ease: o.ease || "back.out(2)" }, a);
  };

  // ---------- 融合：墙面溶解为品牌空间 + 人物轮廓光 ----------
  const G0 = "drop-shadow(0 0 0px rgba(102,212,242,0))", G1 = "drop-shadow(0 0 26px rgba(102,212,242,0.45))";
  L.fusionIn = function (t, o = {}) {
    const tl = L.tl;
    tl.set(L.pw, { opacity: 1 }, t);
    tl.to([L.lw, L.pw], { scale: 1, duration: 0.75, ease: "power2.inOut" }, t);
    tl.fromTo(L.bgw, { clipPath: "circle(0% at 50% 36%)" }, { clipPath: "circle(130% at 50% 36%)", duration: 0.75, ease: "power2.inOut" }, t);
    tl.fromTo(L.pin, { filter: G0 }, { filter: G1, duration: 0.6 }, t + 0.25);
    if (o.riser !== false) L.s(t - 0.05, "riser", { gain: -24 });
  };
  L.fusionOut = function (t) {
    const tl = L.tl;
    tl.to(L.bgw, { clipPath: "circle(0% at 50% 36%)", duration: 0.5, ease: "power2.inOut" }, t);
    tl.to(L.pin, { filter: G0, duration: 0.4 }, t);
    tl.set(L.pw, { opacity: 0 }, t + 0.5);
    tl.fromTo(L.lw, { filter: "blur(10px)" }, { filter: "blur(0px)", duration: 0.55, ease: "power3.out" }, t + 0.05);
  };
  // 真人段慢推近（livewrap 与 personwrap 同步，保证人物层与底片对齐）
  L.push = function (a, b, to) { L.tl.fromTo([L.lw, L.pw], { scale: 1 }, { scale: to || 1.05, duration: b - a, ease: "sine.inOut" }, a); };
  // 人物在 live 段被设为可见（人物后巨字时用）
  L.personOn = function (a, b) { L.tl.set(L.pw, { opacity: 1 }, a); L.tl.set(L.pw, { opacity: 0 }, b); };

  // 人物让位：缩成右上角头像气泡（脸不进字幕区）
  L.yieldTo = function (t, o = {}) {
    const x = o.x == null ? 905 : o.x, y = o.y == null ? 300 : o.y, s = o.s || 0.32;
    L.tl.to(L.pin, { scale: s, x: x - 540, y: y - 1000, clipPath: "circle(330px at 540px 1000px)", duration: 0.75, ease: "power3.inOut" }, t);
    L.s(t, "swish_soft");
  };
  // 头像气泡描边环（屏幕固定）
  L.ring = function (a, b, o = {}) {
    const x = o.x == null ? 905 : o.x, y = o.y == null ? 300 : o.y, r = o.r || 108;
    const e = MU.el("div", "lx-ring", L.$("hud"), null, { left: x - r + "px", top: y - r + "px", width: 2 * r + "px", height: 2 * r + "px" });
    L.tl.set(e, { autoAlpha: 0 }, 0);
    L.tl.fromTo(e, { autoAlpha: 0, scale: 1.25 }, { autoAlpha: 1, scale: 1, duration: 0.5, ease: "power3.out" }, a + 0.45);
    L.tl.to(e, { autoAlpha: 0, duration: 0.25 }, b);
    return e;
  };
  L.unyield = function (t) {
    L.tl.to(L.pin, { scale: 1, x: 0, y: 0, clipPath: "circle(1400px at 540px 1000px)", duration: 0.6, ease: "power3.inOut" }, t);
  };

  // ---------- 图标 ----------
  L.iconTile = function (p, o) {
    const w = MU.el("div", "mu-brand", p, null, { left: o.left + "px", top: o.top + "px" });
    const size = o.size || 140;
    const t = MU.el("div", "mu-brand-tile", w, window.MU_ICONS.lucide[o.name], { width: size + "px", height: size + "px", color: o.color || "var(--cyan)" });
    if (o.tile) t.style.background = o.tile;
    t.querySelector("svg").setAttribute("stroke-width", o.stroke || 1.6);
    if (o.label) MU.el("div", "mu-brand-label", w, o.label, { fontSize: (o.labelSize || Math.round(size * 0.24)) + "px", color: o.labelColor || "" });
    w.tile = t; return w;
  };
  L.text = function (p, html, o) {
    const e = MU.el("div", "lx-text", p, html);
    Object.assign(e.style, { position: "absolute", left: o.left + "px", top: o.top + "px", fontSize: (o.size || 36) + "px", fontWeight: o.weight || 700,
      color: o.color || "var(--text)", fontFamily: o.display ? "var(--f-display)" : "var(--f-ui)", whiteSpace: "nowrap", lineHeight: 1.15 });
    if (o.width) { e.style.width = o.width + "px"; e.style.textAlign = o.align || "left"; }
    return e;
  };
  // 章节导航：顶部横排，只显示当前 ±1
  const CH = window.CHAPTERS || [];
  L.nav = function (idx, a, b, o = {}) {
    const items = [], lo = Math.max(0, idx - 1), hi = Math.min(CH.length - 1, idx + 1);
    const n = MU.el("div", "mu-nav h", L.$(o.layer || "navl"), null, { left: "48px", top: "64px" });
    for (let i = lo; i <= hi; i++) MU.el("div", "mu-nav-item" + (i === idx ? " on" : ""), n, `<span class="dot"></span><b>${String(i + 1).padStart(2, "0")}</b>${CH[i]}`);
    L.tl.set(n, { autoAlpha: 0 }, 0); MU.A.in(L.tl, n, a, { from: "down" }); if (b) MU.A.out(L.tl, n, b - 0.3);
    L.s(a + 0.05, "click");
    return n;
  };

  // ---------- 字幕（keep：原剪映字幕文字＋时间；仿“口播-简约通用字幕”宋体白字投影） ----------
  L.subs = function (host) {
    SUBS.forEach(([a, b, cn, en]) => {
      const s = MU.el("div", "ksub", host, `<div class="cn">${cn}</div><div class="en">${en}</div>`);
      L.tl.set(s, { autoAlpha: 0 }, 0); L.tl.set(s, { autoAlpha: 1 }, a); L.tl.set(s, { autoAlpha: 0 }, b);
    });
  };
  window.L = L;
})();
