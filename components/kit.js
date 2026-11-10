/* vantage-video-editing 组件库（HyperFrames + GSAP）。
 * 约定：构建函数只建 DOM 并返回元素；动画函数把 tween 加到传入的 paused timeline，at 为该时间线内秒数。
 * 全部确定性：无 Math.random、无时钟、无网络。时长/缓动取自 design/tokens.json 的 motion。
 */
(function () {
  const M = { enter: 0.45, exit: 0.3, cross: 0.4, stagger: 0.12, hold: 1.2,
    eIn: "back.out(1.4)", eMove: "power3.inOut", eOut: "power2.in", eData: "power2.out", cps: 14 };
  const NS = "http://www.w3.org/2000/svg";

  function el(tag, cls, parent, html, style) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    if (style) Object.assign(e.style, style);
    if (parent) parent.appendChild(e);
    return e;
  }
  const px = (v) => (typeof v === "number" ? v + "px" : v);
  function place(e, o) { ["left", "top", "right", "bottom", "width", "height"].forEach((k) => { if (o[k] != null) e.style[k] = px(o[k]); }); return e; }

  // ---------- 背景 ----------
  function background(parent, o = {}) {
    const words = o.words || ["万极", "VANTAGE"], rows = o.rows || 24, per = o.per || 9;
    const bg = el("div", "mu-bg", parent);
    const tex = el("div", "mu-tex", bg); tex.setAttribute("data-layout-ignore", ""); tex.setAttribute("aria-hidden", "true");
    if (o.size) tex.style.fontSize = px(o.size);
    for (let r = 0; r < rows; r++) {
      let s = ""; for (let i = 0; i < per; i++) s += words[(i + r) % words.length] + " ";
      el("div", null, tex, s);
    }
    el("div", "mu-vignette", bg);
    return bg;
  }

  // ---------- 构建 ----------
  const hudCard = (p, o) => { const c = place(el("div", "mu-hud", p), o);
    el("div", "mu-hud-title", c, o.title || ""); if (o.sub) el("div", "mu-hud-sub", c, o.sub); return c; };
  const chip = (p, o) => { const icon = { ok: "✓", err: "✕", key: "!", plain: "•" }[o.kind || "plain"];
    return place(el("div", "mu-chip mu-abs " + (o.kind || ""), p, `<i data-text-decor>${icon}</i>${o.text}`), o); };
  function chapterNav(p, o) {
    const n = place(el("div", "mu-nav" + (o.orient === "h" ? " h" : ""), p), o);
    o.items.forEach((t, i) => el("div", "mu-nav-item" + (i === o.active ? " on" : ""), n,
      `<span class="dot"></span><b>${String(i + 1).padStart(2, "0")}</b>${t}`));
    return n;
  }
  const giant = (p, o) => { const g = place(el("div", "mu-giant" + (o.number ? " num" : ""), p, o.html || o.text), o); g.setAttribute("data-layout-allow-overlap", ""); g.setAttribute("data-layout-allow-occlusion", ""); return g; };
  function paper(p, o) {
    const d = place(el("div", "mu-paper", p), o);
    el("div", "mu-paper-head", d, `<span>${o.title || ""}</span>${o.badge ? `<span class="mu-badge">${o.badge}</span>` : ""}`);
    (o.blocks || [{ h: null, lines: 6 }]).forEach((b) => {
      if (b.h) el("div", "mu-paper-h", d, b.h);
      for (let i = 0; i < b.lines; i++) {
        const l = el("div", "mu-paper-line" + (b.mark && b.mark.includes(i) ? " mark" : "") + (b.hl && b.hl.includes(i) ? " hl" : ""), d);
        l.style.width = (i % 4 === 3 ? 62 : 92 - (i * 7) % 15) + "%";
      }
    });
    return d;
  }
  function windowBox(p, o) {
    const w = place(el("div", "mu-window", p), o);
    el("div", "mu-window-bar", w, `<span></span><span></span><span></span><em>${o.title || ""}</em>`);
    w.body = el("div", "mu-window-body", w); return w;
  }
  function phone(p, o) {
    const ph = place(el("div", "mu-phone", p), o);
    ph.screen = el("div", "mu-phone-screen", ph); return ph;
  }
  function msgRows(p, rows) { return rows.map((r) => el("div", "mu-row", p, `<span class="av"></span><span class="tx"><b>${r[0]}</b>${r[1]}</span><span class="unread"></span>`)); }
  function hBars(p, items) {
    const box = el("div", "mu-bars", p);
    return items.map((it) => {
      const r = el("div", "mu-bar-row", box, `<span>${it.label}</span><span class="mu-bar-val">0</span><div class="mu-bar-track"><div class="mu-bar-fill ${it.color || ""}"></div></div>`);
      r.fill = r.querySelector(".mu-bar-fill"); r.val = r.querySelector(".mu-bar-val"); r.item = it; return r;
    });
  }
  function vBars(p, o) {
    const box = place(el("div", "mu-vbars", p), o);
    return o.items.map((it) => {
      const c = el("div", "mu-vbar", box, `<span class="mu-vbar-val">0</span><div class="mu-vbar-fill ${it.color || ""}"></div><span>${it.label}</span>`);
      c.fill = c.querySelector(".mu-vbar-fill"); c.fill.style.height = px((o.maxH || 300) * it.value / o.max);
      if (it.color === "grey") c.fill.style.background = "#6b6e75"; if (it.color === "yellow") c.fill.style.background = "var(--yellow)";
      c.val = c.querySelector(".mu-vbar-val"); c.item = it; return c;
    });
  }
  const counter = (p, o) => place(el("div", "mu-counter", p, `<span class="n">0</span>${o.unit ? `<small>${o.unit}</small>` : ""}`), o);
  function dots(p, o) {
    const g = place(el("div", "mu-dots", p), o); g.style.gridTemplateColumns = `repeat(${o.cols}, 14px)`;
    const cells = []; for (let i = 0; i < o.cols * o.rows; i++) cells.push(el("i", null, g)); g.cells = cells; return g;
  }
  function svg(p, w, h) { const s = document.createElementNS(NS, "svg"); s.setAttribute("class", "mu-svg"); s.setAttribute("viewBox", `0 0 ${w} ${h}`); s.setAttribute("width", w); s.setAttribute("height", h); p.appendChild(s); return s; }
  function path(s, d, o = {}) {
    const e = document.createElementNS(NS, "path"); e.setAttribute("d", d); e.setAttribute("fill", "none");
    e.setAttribute("stroke", o.color || "#66d4f2"); e.setAttribute("stroke-width", o.width || 3); e.setAttribute("stroke-linecap", "round"); e.setAttribute("stroke-linejoin", "round");
    if (o.dash) e.setAttribute("stroke-dasharray", o.dash); s.appendChild(e); return e;
  }
  function brain(s, cx, cy, r, o = {}) {
    // 简化双半球脑形（原创几何，非素材）：两个圆角半球 + 中缝 + 自下而上填充
    const g = document.createElementNS(NS, "g"); s.appendChild(g);
    const id = "mu-brain-" + Math.round(cx) + "-" + Math.round(cy);
    const d = `M ${cx} ${cy - r * .9} C ${cx - r * .35} ${cy - r * 1.1}, ${cx - r * 1.05} ${cy - r * .85}, ${cx - r} ${cy - r * .2}
      C ${cx - r * 1.2} ${cy + r * .25}, ${cx - r * .9} ${cy + r * .85}, ${cx - r * .35} ${cy + r * .8}
      C ${cx - r * .15} ${cy + r * .95}, ${cx} ${cy + r * .85}, ${cx} ${cy + r * .7}
      C ${cx} ${cy + r * .85}, ${cx + r * .15} ${cy + r * .95}, ${cx + r * .35} ${cy + r * .8}
      C ${cx + r * .9} ${cy + r * .85}, ${cx + r * 1.2} ${cy + r * .25}, ${cx + r} ${cy - r * .2}
      C ${cx + r * 1.05} ${cy - r * .85}, ${cx + r * .35} ${cy - r * 1.1}, ${cx} ${cy - r * .9} Z`;
    g.innerHTML = `<defs><clipPath id="${id}"><path d="${d}"/></clipPath></defs>
      <path d="${d}" fill="#26282c" stroke="#e9ecf1" stroke-width="5"/>
      <rect class="fill" clip-path="url(#${id})" x="${cx - r * 1.3}" y="${cy - r * 1.2}" width="${r * 2.6}" height="${r * 2.2}" fill="${o.color || "#3a8ee0"}" />
      <path d="M ${cx} ${cy - r * .85} L ${cx} ${cy + r * .7}" stroke="#e9ecf1" stroke-width="4" stroke-dasharray="2 10" stroke-linecap="round"/>
      <path d="${d}" fill="none" stroke="#e9ecf1" stroke-width="5"/>`;
    g.fillRect = g.querySelector(".fill"); g.cy = cy; g.r = r; return g;
  }
  const stamp = (p, o) => place(el("div", "mu-stamp", p, o.text), o);
  const foot = (p, o) => place(el("div", "mu-foot", p, o.text), o);
  const title = (p, o) => place(el("div", "mu-title", p, o.text), o);
  function subtitle(p, o) { const s = el("div", "mu-sub", p, `<div class="cn">${o.cn}</div>${o.en ? `<div class="en">${o.en}</div>` : ""}`); s.style.top = px(o.top); return s; }


  // ---------- 图标（需先加载 icons/icons.js） ----------
  // 品牌：凡口播提到具体产品/平台/公司，用官方图形＋名称，而不是只写文字。深色品牌（亮度低）用白色图形；有色品牌用官方色。
  function lum(hex) { const n = parseInt(hex.slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; }
  function brandMark(slug, color) {
    const b = (window.MU_ICONS || { brands: {} }).brands[slug]; if (!b) throw new Error("缺少品牌图标: " + slug + "（见 scripts/build_icons.py）");
    if (b.png) return `<img src="${b.png}" alt="">`;
    const fill = color || (lum(b.hex) < 0.12 ? "#ffffff" : b.hex);
    return b.svg.replace("<svg ", `<svg fill="${fill}" `);
  }
  function brand(p, o) {
    const b = window.MU_ICONS.brands[o.slug], size = o.size || 160;
    const w = place(el("div", "mu-brand" + (o.row ? " row" : ""), p), o);
    const t = el("div", "mu-brand-tile", w, brandMark(o.slug, o.color), { width: px(size), height: px(size) });
    if (o.tileColor) t.style.background = o.tileColor;
    if (o.label !== false) el("div", "mu-brand-label", w, o.label || b.title, { fontSize: px(o.labelSize || Math.round(size * 0.26)) });
    w.tile = t; return w;
  }
  function icon(p, o) {
    const svg = (window.MU_ICONS || { lucide: {} }).lucide[o.name]; if (!svg) throw new Error("缺少概念图标: " + o.name);
    const e = place(el("div", "mu-icon", p, svg), Object.assign({ width: o.size || 64, height: o.size || 64 }, o));
    e.style.color = o.color || "var(--text)"; const s = e.querySelector("svg"); if (s) s.setAttribute("stroke-width", o.stroke || 1.75); return e;
  }
  const inlineIcon = (name) => `<span class="mu-inline-icon">${(window.MU_ICONS.lucide[name] || "")}</span>`;
  const inlineBrand = (slug, color) => `<span class="mu-inline-icon">${brandMark(slug, color)}</span>`;

  // ---------- 动画 ----------
  const A = {
    in(tl, e, at, o = {}) {
      const from = { autoAlpha: 0 };
      if (o.from === "left") from.x = -40; else if (o.from === "right") from.x = 40; else if (o.from === "down") from.y = 30; else if (o.from === "scale") from.scale = .9; else from.y = 24;
      tl.fromTo(e, from, { autoAlpha: 1, x: 0, y: 0, scale: 1, duration: o.dur || M.enter, ease: o.ease || M.eIn }, at); return at + (o.dur || M.enter);
    },
    out(tl, e, at, o = {}) { tl.to(e, { autoAlpha: 0, y: o.y || -12, duration: o.dur || M.exit, ease: M.eOut }, at); },
    stagger(tl, els, at, o = {}) { els.forEach((e, i) => A.in(tl, e, at + i * (o.step || M.stagger), o)); return at + (els.length - 1) * (o.step || M.stagger) + M.enter; },
    move(tl, e, at, to, dur) { tl.to(e, Object.assign({ duration: dur || 0.7, ease: M.eMove }, to), at); },
    // 跨场对象连续：同一元素从 A 状态移动/缩放到 B 状态
    morph(tl, e, at, to, dur) { A.move(tl, e, at, to, dur || 0.8); },
    count(tl, node, at, o) {
      const st = { v: o.from || 0 }, f = o.fmt || ((v) => Math.round(v).toLocaleString("en-US"));
      node.textContent = f(st.v);
      tl.to(st, { v: o.to, duration: o.dur || 1.2, ease: M.eData, onUpdate: () => { node.textContent = f(st.v); } }, at);
    },
    hBars(tl, rows, at, o = {}) {
      rows.forEach((r) => {
        const pct = r.item.value / (o.max || 100); r.fill.style.width = "100%";
        tl.fromTo(r.fill, { scaleX: 0 }, { scaleX: pct, duration: o.dur || 1.2, ease: M.eData }, at);
        A.count(tl, r.val, at, { to: r.item.value, dur: o.dur || 1.2, fmt: r.item.fmt });
      });
    },
    vBars(tl, cols, at, o = {}) {
      cols.forEach((c, i) => { const t = at + i * (o.step || 0.08);
        tl.fromTo(c.fill, { scaleY: 0 }, { scaleY: 1, duration: o.dur || 1.1, ease: M.eData }, t);
        A.count(tl, c.val, t, { to: c.item.value, dur: o.dur || 1.1, fmt: c.item.fmt }); });
    },
    draw(tl, p, at, dur) { const L = p.getTotalLength(); p.style.strokeDasharray = L; tl.fromTo(p, { strokeDashoffset: L }, { strokeDashoffset: 0, duration: dur || 0.8, ease: "power1.inOut" }, at); },
    // 流点沿路径移动：n 个点，固定间隔（确定性）
    flow(tl, s, p, at, o = {}) {
      const L = p.getTotalLength(), n = o.n || 6, dur = o.dur || 1.6;
      for (let i = 0; i < n; i++) {
        const c = document.createElementNS(NS, "circle"); c.setAttribute("r", o.r || 6); c.setAttribute("fill", o.color || "#66d4f2"); s.appendChild(c);
        const st = { t: 0 }; const upd = () => { const q = p.getPointAtLength(st.t * L); c.setAttribute("cx", q.x); c.setAttribute("cy", q.y); };
        upd(); tl.set(c, { autoAlpha: 0 }, 0);
        tl.set(c, { autoAlpha: 1 }, at + i * dur / n * 0.6);
        tl.to(st, { t: 1, duration: dur, ease: "none", onUpdate: upd }, at + i * dur / n * 0.6);
        tl.set(c, { autoAlpha: 0 }, at + i * dur / n * 0.6 + dur);
      }
    },
    fillBrain(tl, b, at, level, dur) {
      const r = b.r, y0 = b.cy + r * 1.0, h = r * 2.2;
      tl.fromTo(b.fillRect, { attr: { y: y0 } }, { attr: { y: y0 - h * level }, duration: dur || 1.4, ease: M.eData }, at);
    },
    typing(tl, node, text, at, cps) {
      const st = { n: 0 }; node.innerHTML = '<span class="t"></span><span class="mu-caret"></span>'; const t = node.querySelector(".t");
      tl.to(st, { n: text.length, duration: text.length / (cps || M.cps), ease: "none", onUpdate: () => { t.textContent = text.slice(0, Math.round(st.n)); } }, at);
      return at + text.length / (cps || M.cps);
    },
    stamp(tl, e, at) { tl.fromTo(e, { autoAlpha: 0, scale: 1.45, rotation: 0 }, { autoAlpha: 1, scale: 1, rotation: -6, duration: 0.28, ease: "power4.in" }, at);
      tl.to(e, { scale: 1.03, duration: 0.08, yoyo: true, repeat: 1, ease: "power1.out" }, at + 0.28); },
    dots(tl, g, at, on, dur) { const step = (dur || 1.2) / on.length;
      on.forEach((i, k) => tl.fromTo(g.cells[i], { backgroundColor: "rgba(255,255,255,0.08)" }, { backgroundColor: "#3a8ee0", duration: 0.12, ease: "none" }, at + k * step)); },
    giantIn(tl, e, at) { tl.fromTo(e, { autoAlpha: 0, scale: .94, y: 20 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.6, ease: "power3.out" }, at); },
    crossfade(tl, a, b, at, dur) { tl.to(a, { autoAlpha: 0, duration: dur || M.cross, ease: "power1.inOut" }, at); tl.fromTo(b, { autoAlpha: 0 }, { autoAlpha: 1, duration: dur || M.cross, ease: "power1.inOut" }, at); },
  };

  window.MU = { M, el, brand, icon, inlineIcon, inlineBrand, place, background, hudCard, chip, chapterNav, giant, paper, windowBox, phone, msgRows, hBars, vBars, counter, dots, svg, path, brain, stamp, foot, title, subtitle, A };
})();
