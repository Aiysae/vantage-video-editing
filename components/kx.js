/* kx.js —— 冲击字 / 动作隐喻动效库（确定性、可 seek）。依赖 GSAP、kit.js（MU）。
 * 原则：关键词不是“出现”，而是“发生”——割=刀劈开、关门=门砸上、落地=重物砸地、焦虑=抖动、引语=逐词砸下。
 */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, css, parent, html) => { const e = document.createElement(tag); if (css) Object.assign(e.style, css); if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; };
  const KX = {};
  KX.F = { song: '"KX Song", "Songti SC", serif', black: 'var(--f-display)', lit: '"ZY Song", serif', ui: 'var(--f-ui)' };

  // 确定性伪随机
  KX.rnd = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

  // 镜头震动：对多个元素施加同样的衰减抖动（真人底片与人物层必须同步）
  KX.shake = function (tl, els, t, o = {}) {
    const amp = o.amp || 22, n = o.n || 8, dur = o.dur || 0.32, r = KX.rnd(o.seed || 7);
    const step = dur / n;
    for (let i = 0; i < n; i++) {
      const k = 1 - i / n, x = (r() * 2 - 1) * amp * k, y = (r() * 2 - 1) * amp * 0.7 * k;
      tl.to(els, { x, y, duration: step, ease: "none" }, t + i * step);
    }
    tl.to(els, { x: 0, y: 0, duration: step, ease: "power2.out" }, t + dur);
  };
  // 全屏闪白/闪红
  KX.flash = function (tl, host, t, o = {}) {
    const f = el("div", { position: "absolute", inset: "0", background: o.color || "#fff", opacity: 0, pointerEvents: "none", zIndex: 40 }, host);
    tl.set(f, { opacity: 0 }, 0);
    tl.fromTo(f, { opacity: o.peak || 0.55 }, { opacity: 0, duration: o.dur || 0.35, ease: "power2.out", immediateRender: false }, t);
    return f;
  };
  // 压暗幕：冲击字出现时把真人压暗，让字成为唯一焦点
  KX.dim = function (tl, host, a, b, o = {}) {
    const d = el("div", { position: "absolute", inset: "0", background: o.bg || "radial-gradient(ellipse at 50% 45%, rgba(20,6,6,.55), rgba(0,0,0,.82))", opacity: 0, pointerEvents: "none" }, host);
    tl.set(d, { opacity: 0 }, 0);
    tl.to(d, { opacity: 1, duration: o.in || 0.12, ease: "power2.out" }, a);
    tl.to(d, { opacity: 0, duration: o.out || 0.35, ease: "power2.in" }, b);
    return d;
  };

  /* ---------- 刀劈字：大字被一刀劈开，留下裂缝 ----------
   * o: {char, cx, cy, size, color, font, angle(刀路角度，度), at(劈下时刻), hold, seed} */
  KX.slash = function (tl, host, o) {
    const size = o.size || 860, cx = o.cx || 540, cy = o.cy || 820, ang = (o.angle == null ? -28 : o.angle) * Math.PI / 180;
    const at = o.at, W = size * 1.1, H = size * 1.1, L0 = cx - W / 2, T0 = cy - H / 2;
    const wrap = el("div", { position: "absolute", left: L0 + "px", top: T0 + "px", width: W + "px", height: H + "px" }, host);
    // 刀路：过中心、角度 ang 的直线；把字切成上下两半（polygon 用整框坐标）
    const dx = Math.cos(ang), dy = Math.sin(ang), c = { x: W / 2, y: H / 2 }, far = W * 2;
    const p1 = { x: c.x - dx * far, y: c.y - dy * far }, p2 = { x: c.x + dx * far, y: c.y + dy * far };
    const nx = -dy, ny = dx; // 法向（指向“下半”）
    const poly = (s) => `polygon(${p1.x}px ${p1.y}px, ${p2.x}px ${p2.y}px, ${p2.x + nx * far * s}px ${p2.y + ny * far * s}px, ${p1.x + nx * far * s}px ${p1.y + ny * far * s}px)`;
    const glyph = (clip) => el("div", { position: "absolute", inset: "0", display: "grid", placeItems: "center", fontFamily: o.font || KX.F.song, fontWeight: 900,
      fontSize: size + "px", lineHeight: 1, color: o.color || "#e3262f", clipPath: clip, textShadow: "0 0 40px rgba(227,38,47,.45), 0 18px 50px rgba(0,0,0,.6)" }, wrap, o.char || "割");
    const top = glyph(poly(-1)), bot = glyph(poly(1));
    // 裂缝（亮线 + 红色辉光），沿刀路
    const sv = document.createElementNS(NS, "svg"); sv.setAttribute("width", W); sv.setAttribute("height", H);
    Object.assign(sv.style, { position: "absolute", left: 0, top: 0, overflow: "visible" }); wrap.appendChild(sv);
    const r = KX.rnd(o.seed || 11); let d = `M ${c.x - dx * W * 0.62} ${c.y - dy * W * 0.62}`;
    for (let i = 1; i <= 9; i++) { const t = -0.62 + i * (1.24 / 9), j = (r() * 2 - 1) * 10; d += ` L ${c.x + dx * W * t + nx * j} ${c.y + dy * W * t + ny * j}`; }
    const crack = document.createElementNS(NS, "path"); crack.setAttribute("d", d); crack.setAttribute("fill", "none");
    crack.setAttribute("stroke", "#fff3f0"); crack.setAttribute("stroke-width", 5); crack.setAttribute("stroke-linecap", "round");
    crack.style.filter = "drop-shadow(0 0 10px #ff3b3b) drop-shadow(0 0 22px #ff3b3b)"; sv.appendChild(crack);
    // 刀光：一条细长白光沿刀路高速掠过
    const blade = el("div", { position: "absolute", left: c.x - W * 0.75 + "px", top: c.y - 7 + "px", width: W * 1.5 + "px", height: "14px",
      background: "linear-gradient(90deg, rgba(255,255,255,0), #fff 45%, #fff 55%, rgba(255,255,255,0))", boxShadow: "0 0 30px #fff, 0 0 60px #ff4d4d",
      transform: `rotate(${o.angle == null ? -28 : o.angle}deg)`, transformOrigin: "50% 50%", borderRadius: "7px" }, wrap);
    // 碎片
    const shards = [];
    for (let i = 0; i < 9; i++) {
      const s = el("div", { position: "absolute", left: c.x + (r() * 2 - 1) * W * 0.35 + "px", top: c.y + (r() * 2 - 1) * 40 + "px", width: 10 + r() * 18 + "px", height: 4 + r() * 8 + "px",
        background: i % 3 ? "#e3262f" : "#fff", transform: `rotate(${r() * 180}deg)` }, wrap);
      s.v = { x: (r() * 2 - 1) * 260, y: (r() * 2 - 1) * 220 - 60 }; shards.push(s);
    }
    // —— 时间线 ——
    const pre = 0.16;
    tl.set(wrap, { autoAlpha: 0 }, 0); tl.set(wrap, { autoAlpha: 1 }, at - pre);
    tl.set([top, bot, crack, ...shards], { autoAlpha: 0 }, 0);
    // 字先整体砸入（1.35→1），刀光在字落定瞬间劈过
    tl.fromTo([top, bot], { autoAlpha: 0, scale: 1.35 }, { autoAlpha: 1, scale: 1, duration: pre, ease: "power4.in" }, at - pre);
    tl.fromTo(blade, { autoAlpha: 1, xPercent: -60, scaleX: 0.3 }, { xPercent: 60, scaleX: 1, duration: 0.14, ease: "power2.in" }, at);
    tl.to(blade, { autoAlpha: 0, duration: 0.12 }, at + 0.14);
    tl.set(crack, { autoAlpha: 1 }, at + 0.1); A_draw(tl, crack, at + 0.06, 0.12);
    const sep = o.sep || 26;
    tl.to(top, { x: -nx * sep, y: -ny * sep, rotation: -1.5, duration: 0.35, ease: "power3.out" }, at + 0.12);
    tl.to(bot, { x: nx * sep, y: ny * sep, rotation: 1.5, duration: 0.35, ease: "power3.out" }, at + 0.12);
    shards.forEach((sh, i) => { tl.fromTo(sh, { autoAlpha: 1, x: 0, y: 0 }, { x: sh.v.x, y: sh.v.y + 120, rotation: "+=200", autoAlpha: 0, duration: 0.7, ease: "power2.out" }, at + 0.1 + i * 0.01); });
    // 退场：两半继续错开、下坠淡出
    const out = at + (o.hold || 1.2);
    tl.to(top, { x: -nx * sep * 4, y: -ny * sep * 4 - 30, autoAlpha: 0, duration: 0.35, ease: "power2.in" }, out);
    tl.to(bot, { x: nx * sep * 4, y: ny * sep * 4 + 60, autoAlpha: 0, duration: 0.35, ease: "power2.in" }, out);
    tl.to(crack, { autoAlpha: 0, duration: 0.25 }, out);
    tl.set(wrap, { autoAlpha: 0 }, out + 0.4);
    return wrap;
  };
  function A_draw(tl, p, at, dur) { const L = p.getTotalLength(); p.style.strokeDasharray = L; tl.fromTo(p, { strokeDashoffset: L }, { strokeDashoffset: 0, duration: dur, ease: "power2.out" }, at); }

  /* ---------- 砸门：一扇门“啪”地关上 ----------
   * o: {cx, top, w, h, at(关上的时刻), hold, label} */
  KX.door = function (tl, host, o) {
    const w = o.w || 560, h = o.h || 1000, left = (o.cx || 540) - w / 2, top = o.top || 300, at = o.at;
    const stage = el("div", { position: "absolute", left: left - 40 + "px", top: top - 40 + "px", width: w + 80 + "px", height: h + 80 + "px", perspective: "1400px" }, host);
    // 门洞：门里透出的暖光（关门后消失）
    const frame = el("div", { position: "absolute", left: "0", top: "0", right: "0", bottom: "0", borderRadius: "10px", background: "#0c0d0f", boxShadow: "inset 0 0 0 18px #2e3036, 0 40px 90px rgba(0,0,0,.6)" }, stage);
    const light = el("div", { position: "absolute", left: "18px", top: "18px", right: "18px", bottom: "18px", background: "radial-gradient(ellipse at 50% 60%, rgba(255,214,140,.95), rgba(255,170,60,.55) 45%, rgba(40,30,20,.2) 100%)" }, frame);
    const glowOut = el("div", { position: "absolute", left: "50%", top: "50%", width: w * 1.8 + "px", height: h * 1.2 + "px", marginLeft: -w * 0.9 + "px", marginTop: -h * 0.6 + "px",
      background: "radial-gradient(ellipse, rgba(255,190,90,.35), rgba(0,0,0,0) 60%)", pointerEvents: "none" }, stage);
    stage.insertBefore(glowOut, frame);
    // 门板（左侧铰链）
    const door = el("div", { position: "absolute", left: "40px", top: "40px", width: w + "px", height: h + "px", transformOrigin: "0% 50%", borderRadius: "6px",
      background: "linear-gradient(90deg, #2b2d33, #34373e 60%, #2b2d33)", boxShadow: "inset 0 0 0 2px rgba(255,255,255,.06), 0 30px 70px rgba(0,0,0,.55)" }, stage);
    [[0.12, 0.06, 0.76, 0.38], [0.12, 0.52, 0.76, 0.40]].forEach(([x, y, ww, hh]) =>
      el("div", { position: "absolute", left: x * w + "px", top: y * h + "px", width: ww * w + "px", height: hh * h + "px", borderRadius: "6px", boxShadow: "inset 0 0 0 3px rgba(0,0,0,.35), inset 0 0 0 5px rgba(255,255,255,.05)" }, door));
    el("div", { position: "absolute", right: "46px", top: h * 0.48 + "px", width: "26px", height: "86px", borderRadius: "13px", background: "linear-gradient(#c9ced6, #7d828c)", boxShadow: "0 4px 10px rgba(0,0,0,.5)" }, door);
    const label = el("div", { position: "absolute", left: "0", right: "0", top: h * 0.2 + "px", textAlign: "center", fontFamily: KX.F.song, fontWeight: 900, fontSize: (o.labelSize || 170) + "px", color: "#e3262f",
      letterSpacing: ".04em", lineHeight: 1.05, textShadow: "0 0 30px rgba(227,38,47,.35)" }, door, o.label || "关门");
    // 灰尘
    const r = KX.rnd(o.seed || 5), puffs = [];
    for (let i = 0; i < 7; i++) puffs.push(el("div", { position: "absolute", left: 40 + r() * w + "px", top: h + 20 + r() * 40 + "px", width: "120px", height: "60px", marginLeft: "-60px", borderRadius: "50%",
      background: "rgba(200,200,205,.35)", filter: "blur(14px)" }, stage));
    // —— 时间线 ——
    const open = o.openAt || at - 0.55;
    tl.set(stage, { autoAlpha: 0 }, 0);
    tl.fromTo(stage, { autoAlpha: 0, scale: 0.92 }, { autoAlpha: 1, scale: 1, duration: 0.25, ease: "power3.out" }, open);
    tl.set(door, { rotationY: -100 }, 0); tl.set(label, { autoAlpha: 0 }, 0);
    tl.to(door, { rotationY: -96, duration: at - 0.16 - open, ease: "sine.inOut" }, open);          // 悬停微晃
    tl.to(door, { rotationY: 0, duration: 0.16, ease: "power4.in" }, at - 0.16);                    // 啪！
    tl.to(door, { rotationY: -3, duration: 0.07, ease: "power1.out", yoyo: true, repeat: 1 }, at);  // 回弹
    tl.to([light, glowOut], { opacity: 0, duration: 0.12 }, at - 0.04);
    tl.fromTo(label, { autoAlpha: 0, scale: 1.5 }, { autoAlpha: 1, scale: 1, duration: 0.18, ease: "power4.in" }, at + 0.08);
    puffs.forEach((p, i) => tl.fromTo(p, { opacity: 0.9, scale: 0.3, x: 0 }, { opacity: 0, scale: 2.2, x: (i - 3) * 40, y: -30, duration: 0.8, ease: "power2.out" }, at));
    tl.set(puffs, { opacity: 0 }, 0);
    const out = at + (o.hold || 1.0);
    tl.to(stage, { autoAlpha: 0, scale: 0.96, duration: 0.3, ease: "power2.in" }, out);
    return stage;
  };

  /* ---------- 重量对比：大词砸下、把小词挤开 ---------- */
  KX.weigh = function (tl, host, o) {
    const big = el("div", { position: "absolute", left: o.big.left + "px", top: o.big.top + "px", fontFamily: KX.F.song, fontWeight: 900, fontSize: o.big.size + "px", color: o.big.color || "#c21f2a",
      lineHeight: 1, whiteSpace: "nowrap", textShadow: "0 10px 30px rgba(255,255,255,.25)" }, host, o.big.text);
    const small = el("div", { position: "absolute", left: o.small.left + "px", top: o.small.top + "px", fontFamily: KX.F.ui, fontWeight: 700, fontSize: o.small.size + "px", color: o.small.color || "#55585f",
      lineHeight: 1, whiteSpace: "nowrap" }, host, o.small.text);
    const sign = el("div", { position: "absolute", left: o.sign.left + "px", top: o.sign.top + "px", fontFamily: KX.F.black, fontWeight: 900, fontSize: o.sign.size + "px", color: "#16171a", lineHeight: 1 }, host, "&gt;");
    tl.set([big, small, sign], { autoAlpha: 0 }, 0);
    tl.fromTo(small, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: "power3.out" }, o.smallAt);
    tl.fromTo(big, { autoAlpha: 0, scale: 1.8, y: -60 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.22, ease: "power4.in" }, o.bigAt);
    const pa = o.pushAt || o.bigAt + 0.2;
    tl.to(small, { scale: 0.72, x: o.push || 40, duration: 0.3, ease: "back.out(2)" }, pa);
    tl.fromTo(sign, { autoAlpha: 0, scale: 0.4 }, { autoAlpha: 1, scale: 1, duration: 0.3, ease: "back.out(3)" }, pa + 0.1);
    if (o.out) tl.to([big, small, sign], { autoAlpha: 0, y: -20, duration: 0.3, ease: "power2.in" }, o.out);
    return { big, small, sign };
  };

  /* ---------- 引语逐词砸下（宋体），关键词红色 + 手绘下划线 ---------- */
  KX.quote = function (tl, host, o) {
    const box = el("div", { position: "absolute", left: o.left + "px", top: o.top + "px", width: (o.width || 960) + "px", fontFamily: KX.F.song, fontWeight: 900, fontSize: (o.size || 120) + "px",
      lineHeight: 1.15, color: o.color || "#16171a" }, host);
    const qm = el("span", { position: "absolute", left: "-70px", top: "-50px", fontSize: (o.size || 120) * 1.6 + "px", color: "#c21f2a", opacity: .9 }, box, "“");
    tl.set(qm, { autoAlpha: 0 }, 0); tl.fromTo(qm, { autoAlpha: 0, scale: 2 }, { autoAlpha: 1, scale: 1, duration: 0.2, ease: "power4.in" }, o.at - 0.1);
    const spans = [];
    o.words.forEach(([w, t, hot]) => {
      const s = el("span", { display: "inline-block", color: hot ? "#c21f2a" : "", position: "relative" }, box, w);
      if (w === "\n") { s.style.display = "block"; s.textContent = ""; return; }
      tl.set(s, { autoAlpha: 0 }, 0); tl.fromTo(s, { autoAlpha: 0, y: -50, scale: 1.25 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.18, ease: "power4.in" }, t);
      if (hot) {
        const sv = document.createElementNS(NS, "svg"); sv.setAttribute("viewBox", "0 0 200 30"); sv.setAttribute("preserveAspectRatio", "none");
        Object.assign(sv.style, { position: "absolute", left: "-4%", bottom: "-18px", width: "108%", height: "28px", overflow: "visible" }); s.appendChild(sv);
        const p = document.createElementNS(NS, "path"); p.setAttribute("d", "M 4 18 C 40 6, 80 26, 120 14 S 180 8, 196 16"); p.setAttribute("fill", "none"); p.setAttribute("stroke", "#c21f2a"); p.setAttribute("stroke-width", 7); p.setAttribute("stroke-linecap", "round");
        sv.appendChild(p); tl.set(sv, { autoAlpha: 0 }, 0); tl.set(sv, { autoAlpha: 1 }, t + 0.2); A_draw(tl, p, t + 0.2, 0.3);
      }
      spans.push(s);
    });
    if (o.out) tl.to(box, { autoAlpha: 0, y: -24, duration: 0.3, ease: "power2.in" }, o.out);
    return box;
  };

  /* ---------- 打字机（等宽、带光标）：用于“旁白/内心独白” ---------- */
  KX.typer = function (tl, host, o) {
    const e = el("div", { position: "absolute", left: o.left + "px", top: o.top + "px", fontFamily: '"SF Mono", Menlo, monospace, var(--f-ui)', fontWeight: 600, fontSize: (o.size || 40) + "px",
      color: o.color || "#16171a", background: o.bg || "rgba(255,255,255,.72)", padding: "10px 18px", borderRadius: "10px", whiteSpace: "nowrap" }, host);
    tl.set(e, { autoAlpha: 0 }, 0); tl.set(e, { autoAlpha: 1 }, o.at);
    MU.A.typing(tl, e, o.text, o.at, o.cps || 12);
    if (o.out) tl.to(e, { autoAlpha: 0, duration: 0.25 }, o.out);
    return e;
  };

  const ICON = (name, color, size, sw) => { const s = (window.MU_ICONS.lucide[name] || "").replace(/\s(width|height)="[^"]*"/g, "").replace("<svg ", `<svg width="${size}" height="${size}" style="color:${color};display:block" `); return sw ? s.replace(/stroke-width="[\d.]+"/, `stroke-width="${sw}"`) : s; };

  /* ---------- 削减：一组人中一部分被标红清走，剩余重新排好 ----------
   * o: {left, top, cols, rows, gap, size, icon, remove:[索引] 或 ratio, markAt, at, color, label} */
  KX.crowd = function (tl, host, o) {
    const cols = o.cols || 5, rows = o.rows || 2, n = cols * rows, gap = o.gap || 150, size = o.size || 110;
    const box = el("div", { position: "absolute", left: o.left + "px", top: o.top + "px", width: cols * gap + "px", height: rows * gap + "px" }, host);
    const rm = o.remove || Array.from({ length: n }, (_, i) => i).filter((i) => i % 2 === 1);
    const figs = [];
    for (let i = 0; i < n; i++) {
      const f = el("div", { position: "absolute", left: (i % cols) * gap + "px", top: Math.floor(i / cols) * gap + "px", width: size + "px", height: size + "px", display: "grid", placeItems: "center",
        borderRadius: "28%", background: "rgba(18,19,22,.9)", border: "1px solid rgba(255,255,255,.1)" }, box, ICON(o.icon || "headset", "#e9ecf1", size * 0.58, 1.7));
      figs.push(f);
    }
    tl.set(figs, { autoAlpha: 0 }, 0);
    figs.forEach((f, i) => tl.fromTo(f, { autoAlpha: 0, y: 30, scale: 0.7 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.35, ease: "back.out(2)" }, o.in + i * 0.05));
    rm.forEach((i) => { tl.to(figs[i], { backgroundColor: "#e3262f", duration: 0.15 }, o.markAt + 0.04 * (i % cols)); });
    rm.forEach((i, k) => tl.to(figs[i], { y: 260, rotation: (k % 2 ? 25 : -25), autoAlpha: 0, duration: 0.45, ease: "power3.in" }, o.at + k * 0.05));
    // 剩余的人向左上收拢成一排
    const keep = figs.filter((_, i) => !rm.includes(i));
    keep.forEach((f, k) => tl.to(f, { left: (k % cols) * gap + "px", top: Math.floor(k / cols) * gap + "px", duration: 0.5, ease: "power3.inOut" }, o.at + 0.5));
    if (o.label) { const lb = el("div", { position: "absolute", left: "0", top: rows * gap + 10 + "px", fontFamily: KX.F.song, fontWeight: 900, fontSize: (o.labelSize || 90) + "px", color: "#e3262f", whiteSpace: "nowrap" }, box, o.label);
      tl.set(lb, { autoAlpha: 0 }, 0); tl.fromTo(lb, { autoAlpha: 0, scale: 1.5 }, { autoAlpha: 1, scale: 1, duration: 0.2, ease: "power4.in" }, o.at + 0.2); }
    if (o.out) tl.to(box, { autoAlpha: 0, duration: 0.3 }, o.out);
    return box;
  };

  /* ---------- 合并：N 个对象汇成一个（一人干三人的活） ---------- */
  KX.merge = function (tl, host, o) {
    const n = o.n || 3, size = o.size || 130, cx = o.cx || 540, cy = o.cy || 700, spread = o.spread || 300;
    const box = el("div", { position: "absolute", left: "0", top: "0", width: "1080px", height: "1920px" }, host);
    const figs = [];
    for (let i = 0; i < n; i++) figs.push(el("div", { position: "absolute", left: cx - size / 2 + (i - (n - 1) / 2) * spread + "px", top: cy - size / 2 + "px", width: size + "px", height: size + "px", display: "grid", placeItems: "center",
      borderRadius: "28%", background: "rgba(18,19,22,.9)", border: "1px solid rgba(255,255,255,.1)" }, box, ICON(o.icon || "user-round", "#9a9da5", size * 0.6, 1.7)));
    const one = el("div", { position: "absolute", left: cx - size * 0.7 + "px", top: cy - size * 0.7 + "px", width: size * 1.4 + "px", height: size * 1.4 + "px", display: "grid", placeItems: "center",
      borderRadius: "28%", background: "#10262d", border: "2px solid #66d4f2", boxShadow: "0 0 50px rgba(102,212,242,.55)" }, box, ICON(o.oneIcon || "bot", "#66d4f2", size * 0.85, 1.6));
    const lb = el("div", { position: "absolute", left: "0", width: "1080px", top: cy + size * 0.8 + 10 + "px", textAlign: "center", fontFamily: KX.F.black, fontWeight: 900, fontSize: "80px", color: "#f2f3f5" }, box, o.label || "");
    tl.set([...figs, one, lb], { autoAlpha: 0 }, 0);
    figs.forEach((f, i) => tl.fromTo(f, { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.3, ease: "back.out(2)" }, o.in + i * 0.12));
    figs.forEach((f, i) => tl.to(f, { x: -(i - (n - 1) / 2) * spread, scale: 0.5, autoAlpha: 0, duration: 0.45, ease: "power3.in" }, o.at));
    tl.fromTo(one, { autoAlpha: 0, scale: 0.4 }, { autoAlpha: 1, scale: 1, duration: 0.35, ease: "back.out(2.5)" }, o.at + 0.4);
    tl.fromTo(lb, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: "power3.out" }, o.at + 0.6);
    if (o.out) tl.to(box, { autoAlpha: 0, duration: 0.3 }, o.out);
    return box;
  };

  /* ---------- 落定：悬着的重物，绳断，砸地扬尘 ---------- */
  KX.drop = function (tl, host, o) {
    const cx = o.cx || 540, ground = o.ground || 560, w = o.w || 300, h = o.h || 200;
    const box = el("div", { position: "absolute", left: "0", top: "0", width: "1080px", height: "1920px" }, host);
    const rope = el("div", { position: "absolute", left: cx - 2 + "px", top: "0", width: "4px", height: ground - h - 160 + "px", background: "#3a3c42", transformOrigin: "50% 0" }, box);
    const wt = el("div", { position: "absolute", left: cx - w / 2 + "px", top: ground - h - 160 + "px", width: w + "px", height: h + "px", borderRadius: "16px 16px 10px 10px",
      background: "linear-gradient(#3c3f46, #22242a)", display: "grid", placeItems: "center", fontFamily: KX.F.song, fontWeight: 900, fontSize: (o.size || 110) + "px", color: "#f2f3f5", boxShadow: "0 24px 50px rgba(0,0,0,.4)" }, box, o.text || "心");
    const line = el("div", { position: "absolute", left: cx - 260 + "px", top: ground + "px", width: "520px", height: "8px", borderRadius: "4px", background: "rgba(18,19,22,.85)" }, box);
    const r = KX.rnd(o.seed || 21), dust = [];
    for (let i = 0; i < 8; i++) dust.push(el("div", { position: "absolute", left: cx - 240 + r() * 480 + "px", top: ground - 30 + "px", width: "110px", height: "50px", marginLeft: "-55px", borderRadius: "50%", background: "rgba(170,170,175,.45)", filter: "blur(12px)" }, box));
    tl.set([rope, wt, line, ...dust], { autoAlpha: 0 }, 0);
    tl.fromTo([rope, wt], { autoAlpha: 0, y: -200 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out" }, o.in);
    tl.fromTo(line, { autoAlpha: 0, scaleX: 0 }, { autoAlpha: 1, scaleX: 1, duration: 0.3 }, o.in + 0.1);
    [0, 1, 2, 3].forEach((i) => tl.to(wt, { rotation: i % 2 ? -4 : 4, duration: 0.3, ease: "sine.inOut" }, o.in + 0.4 + i * 0.3));
    tl.to(rope, { scaleY: 0.3, autoAlpha: 0, duration: 0.15 }, o.at - 0.28);
    tl.to(wt, { y: 160, rotation: 0, duration: 0.28, ease: "power3.in" }, o.at - 0.28);
    tl.to(wt, { scaleY: 0.92, scaleX: 1.05, transformOrigin: "50% 100%", duration: 0.06, yoyo: true, repeat: 1 }, o.at);
    dust.forEach((d, i) => tl.fromTo(d, { autoAlpha: 0.9, scale: 0.3, x: 0 }, { autoAlpha: 0, scale: 2, x: (i - 3.5) * 36, y: -24, duration: 0.8, ease: "power2.out" }, o.at));
    if (o.label) { const lb = el("div", { position: "absolute", left: cx + w / 2 + 30 + "px", top: ground - 120 + "px", fontFamily: KX.F.black, fontWeight: 900, fontSize: "64px", color: "#16171a", whiteSpace: "nowrap" }, box, o.label);
      tl.set(lb, { autoAlpha: 0 }, 0); tl.fromTo(lb, { autoAlpha: 0, x: -20 }, { autoAlpha: 1, x: 0, duration: 0.3 }, o.at + 0.15); }
    if (o.out) tl.to(box, { autoAlpha: 0, duration: 0.3 }, o.out);
    return box;
  };

  /* ---------- 不安：字抖动 + 色差错位 ---------- */
  KX.jitter = function (tl, e, a, b, o = {}) {
    const r = KX.rnd(o.seed || 13), amp = o.amp || 7, step = 0.06;
    for (let t = a; t < b; t += step) {
      const x = (r() * 2 - 1) * amp, y = (r() * 2 - 1) * amp * 0.6, s = (r() * 2 - 1) * 6;
      tl.to(e, { x, y, textShadow: `${s}px 0 rgba(0,220,255,.7), ${-s}px 0 rgba(255,0,60,.7)`, duration: step, ease: "none" }, t);
    }
    tl.to(e, { x: 0, y: 0, textShadow: "0 0 0 rgba(0,0,0,0)", duration: step }, b);
  };

  /* ---------- 加速：字被拉长 + 速度线（每拍一次） ---------- */
  KX.speed = function (tl, host, o) {
    const box = el("div", { position: "absolute", left: o.left + "px", top: o.top + "px", width: (o.width || 900) + "px", height: (o.size || 220) * 1.1 + "px" }, host);
    const txt = el("div", { position: "absolute", left: "0", top: "0", fontFamily: KX.F.black, fontWeight: 900, fontSize: (o.size || 220) + "px", lineHeight: 1, color: o.color || "#16171a", whiteSpace: "nowrap", fontStyle: "italic", transformOrigin: "0% 50%" }, box, o.text);
    const lines = [];
    for (let i = 0; i < 6; i++) lines.push(el("div", { position: "absolute", left: "-260px", top: 20 + i * ((o.size || 220) / 6) + "px", width: 180 + (i % 3) * 60 + "px", height: "6px", borderRadius: "3px", background: o.lineColor || "#e3262f" }, box));
    tl.set([txt, ...lines], { autoAlpha: 0 }, 0);
    tl.fromTo(txt, { autoAlpha: 0, x: -300, skewX: -20 }, { autoAlpha: 1, x: 0, skewX: -8, duration: 0.25, ease: "power4.out" }, o.in);
    (o.beats || []).forEach((t, k) => {
      tl.fromTo(txt, { scaleX: 1.35 + k * 0.1 }, { scaleX: 1, duration: 0.3, ease: "power3.out" }, t);
      lines.forEach((l, i) => tl.fromTo(l, { autoAlpha: 1, x: 0 }, { autoAlpha: 0, x: -200 - i * 20, duration: 0.3, ease: "power2.out" }, t + i * 0.015));
    });
    if (o.out) tl.to(txt, { autoAlpha: 0, x: 400, duration: 0.25, ease: "power3.in" }, o.out);
    return box;
  };

  /* ---------- 流失：钱币一枚枚从钱包/账户落下 ---------- */
  KX.coins = function (tl, host, o) {
    const box = el("div", { position: "absolute", left: o.left + "px", top: o.top + "px", width: "420px", height: "520px", transformOrigin: "0 0" }, host);
    if (o.scale) box.style.scale = o.scale;
    const wallet = el("div", { position: "absolute", left: "60px", top: "0", width: "300px", height: "190px", borderRadius: "26px", background: "linear-gradient(#3a3c42,#25272c)", display: "grid", placeItems: "center",
      boxShadow: "0 20px 40px rgba(0,0,0,.45)" }, box, ICON("wallet", "#f2d34a", 110, 1.6));
    tl.set(wallet, { autoAlpha: 0 }, 0); tl.fromTo(wallet, { autoAlpha: 0, scale: 0.7 }, { autoAlpha: 1, scale: 1, duration: 0.35, ease: "back.out(2)" }, o.in);
    (o.drops || []).forEach(([t, label], i) => {
      const c = el("div", { position: "absolute", left: 150 + (i % 3 - 1) * 70 + "px", top: "150px", width: "110px", height: "110px", borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #ffe27a, #d9a400)",
        border: "4px solid #b88700", display: "grid", placeItems: "center", fontFamily: KX.F.ui, fontWeight: 800, fontSize: "26px", color: "#5a3f00" }, box, label);
      tl.set(c, { autoAlpha: 0 }, 0);
      tl.fromTo(c, { autoAlpha: 1, y: 0, rotation: 0 }, { y: o.fall || 330, rotation: (i % 2 ? 40 : -40), duration: 0.55, ease: "power2.in" }, t);
      tl.to(c, { autoAlpha: 0.0, duration: 0.2 }, t + 0.6);
      tl.to(wallet, { scale: 0.96, duration: 0.08, yoyo: true, repeat: 1 }, t);
    });
    if (o.out) tl.to(box, { autoAlpha: 0, duration: 0.3 }, o.out);
    return box;
  };

  /* ---------- 断裂：一张单据/合同被撕成两半 ---------- */
  KX.tear = function (tl, host, o) {
    const w = o.w || 520, h = o.h || 620;
    const box = el("div", { position: "absolute", left: o.left + "px", top: o.top + "px", width: w + "px", height: h + "px" }, host);
    const zig = []; for (let i = 0; i <= 12; i++) zig.push(`${w / 2 + (i % 2 ? 14 : -14)}px ${(h / 12) * i}px`);
    const half = (side) => {
      const p = el("div", { position: "absolute", inset: "0", background: "#f6f6f4", borderRadius: "8px", boxShadow: "0 24px 60px rgba(0,0,0,.5)", padding: "36px", boxSizing: "border-box", color: "#1d1f24",
        clipPath: side < 0 ? `polygon(0 0, ${zig.join(", ")}, 0 100%)` : `polygon(100% 0, ${zig.join(", ")}, 100% 100%)` }, box);
      p.innerHTML = `<div style="font:900 52px ${KX.F.song.replace(/"/g, "'")}">${o.title || "续费合同"}</div>` + Array.from({ length: 7 }, (_, i) => `<div style="height:12px;border-radius:6px;background:#d9dbe0;margin:24px 0;width:${90 - (i * 9) % 30}%"></div>`).join("") +
        `<div style="position:absolute;right:40px;bottom:40px;font:700 30px sans-serif;color:#2b6fb8">待续签</div>`;
      return p;
    };
    const L1 = half(-1), R1 = half(1);
    tl.set(box, { autoAlpha: 0 }, 0); tl.fromTo(box, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: "power3.out" }, o.in);
    tl.to(L1, { x: -90, rotation: -9, duration: 0.35, ease: "power3.out" }, o.at);
    tl.to(R1, { x: 90, rotation: 9, y: 30, duration: 0.35, ease: "power3.out" }, o.at);
    tl.to([L1, R1], { y: "+=420", autoAlpha: 0, duration: 0.6, ease: "power2.in" }, o.at + 0.7);
    return box;
  };

  /* ---------- 扩散：一个气泡复制成很多个向外散开 ---------- */
  KX.spread = function (tl, host, o) {
    const box = el("div", { position: "absolute", left: "0", top: "0", width: "1080px", height: "1920px" }, host);
    const r = KX.rnd(o.seed || 31), cx = o.cx || 300, cy = o.cy || 500, bubbles = [];
    const mega = el("div", { position: "absolute", left: cx - 80 + "px", top: cy - 80 + "px", width: "160px", height: "160px", display: "grid", placeItems: "center", borderRadius: "28%", background: "rgba(18,19,22,.9)" }, box, ICON("megaphone", "#e3262f", 96, 1.6));
    for (let i = 0; i < (o.n || 7); i++) bubbles.push(el("div", { position: "absolute", left: cx + "px", top: cy + "px", padding: "10px 22px", borderRadius: "999px", background: "#e3262f", color: "#fff", fontFamily: KX.F.ui, fontWeight: 800, fontSize: "34px", whiteSpace: "nowrap" }, box, o.text || "AI 没用"));
    tl.set([mega, ...bubbles], { autoAlpha: 0 }, 0);
    tl.fromTo(mega, { autoAlpha: 0, scale: 0.5 }, { autoAlpha: 1, scale: 1, duration: 0.3, ease: "back.out(2)" }, o.in);
    bubbles.forEach((b, i) => { const ang = -0.9 + i * 0.32, d = 260 + r() * 260;
      tl.fromTo(b, { autoAlpha: 0, x: 0, y: 0, scale: 0.4 }, { autoAlpha: 1, x: Math.cos(ang) * d + 60, y: Math.sin(ang) * d * 0.7, scale: 0.75 + r() * 0.4, duration: 0.5, ease: "power3.out" }, o.in + 0.3 + i * 0.12); });
    if (o.out) tl.to(box, { autoAlpha: 0, duration: 0.3 }, o.out);
    return box;
  };

  /* ---------- 定位：放大镜扫过一排节点，停在问题点 ---------- */
  KX.scan = function (tl, host, o) {
    const g = el("div", { position: "absolute", left: o.x0 + "px", top: o.y + "px", width: "120px", height: "120px", marginLeft: "-60px", marginTop: "-60px", display: "grid", placeItems: "center" }, host, ICON("search", o.color || "#f2d34a", 120, 2.2));
    tl.set(g, { autoAlpha: 0 }, 0); tl.set(g, { autoAlpha: 1 }, o.in);
    tl.fromTo(g, { x: 0 }, { x: o.x1 - o.x0, duration: o.dur || 1.2, ease: "sine.inOut" }, o.in);
    tl.to(g, { x: o.stop - o.x0, scale: 1.25, duration: 0.4, ease: "back.out(2)" }, o.in + (o.dur || 1.2));
    if (o.out) tl.to(g, { autoAlpha: 0, duration: 0.25 }, o.out);
    return g;
  };

  /* ---------- 命中：飞镖射中靶心 ---------- */
  KX.dart = function (tl, host, o) {
    const cx = o.cx, cy = o.cy, R = o.r || 120;
    const box = el("div", { position: "absolute", left: "0", top: "0", width: "1080px", height: "1920px" }, host);
    const rings = [1, 0.7, 0.4].map((k, i) => el("div", { position: "absolute", left: cx - R * k + "px", top: cy - R * k + "px", width: 2 * R * k + "px", height: 2 * R * k + "px", borderRadius: "50%", background: i % 2 ? "#f2f3f5" : "#e3262f" }, box));
    const dart = el("div", { position: "absolute", left: cx + "px", top: cy - 6 + "px", width: "220px", height: "12px", background: "linear-gradient(90deg,#16171a 70%,#66d4f2)", transformOrigin: "0 50%", transform: "rotate(-30deg)", borderRadius: "6px" }, box);
    const wave = el("div", { position: "absolute", left: cx - R + "px", top: cy - R + "px", width: 2 * R + "px", height: 2 * R + "px", borderRadius: "50%", border: "6px solid #66d4f2" }, box);
    tl.set([...rings, dart, wave], { autoAlpha: 0 }, 0);
    rings.forEach((rg, i) => tl.fromTo(rg, { autoAlpha: 0, scale: 0.3 }, { autoAlpha: 1, scale: 1, duration: 0.3, ease: "back.out(2)" }, o.in + i * 0.06));
    tl.fromTo(dart, { autoAlpha: 1, x: 600, y: -360 }, { x: 0, y: 0, duration: 0.22, ease: "power3.in" }, o.at - 0.22);
    tl.fromTo(wave, { autoAlpha: 1, scale: 0.4 }, { autoAlpha: 0, scale: 2, duration: 0.6, ease: "power2.out" }, o.at);
    if (o.out) tl.to(box, { autoAlpha: 0, duration: 0.3 }, o.out);
    return box;
  };

  /* ---------- 时间缩短：时钟指针倒转 + 分钟计数 ---------- */
  KX.clock = function (tl, host, o) {
    const box = el("div", { position: "absolute", left: o.left + "px", top: o.top + "px", width: "900px", height: "320px", transformOrigin: "0 0" }, host);
    if (o.scale) box.style.scale = o.scale;
    const face = el("div", { position: "absolute", left: "0", top: "0", width: "300px", height: "300px", borderRadius: "50%", background: "#f6f6f4", boxShadow: "0 20px 50px rgba(0,0,0,.45), inset 0 0 0 10px #2b2d33" }, box);
    for (let i = 0; i < 12; i++) el("div", { position: "absolute", left: "147px", top: "18px", width: "6px", height: "22px", background: "#1d1f24", transformOrigin: "3px 132px", transform: `rotate(${i * 30}deg)` }, face);
    const hand = el("div", { position: "absolute", left: "146px", top: "40px", width: "8px", height: "112px", borderRadius: "4px", background: "#e3262f", transformOrigin: "4px 110px" }, face);
    el("div", { position: "absolute", left: "138px", top: "138px", width: "24px", height: "24px", borderRadius: "50%", background: "#1d1f24" }, face);
    const num = el("div", { position: "absolute", left: "350px", top: "60px", fontFamily: KX.F.black, fontWeight: 900, fontSize: "170px", lineHeight: 1, color: o.color || "#f2f3f5", fontVariantNumeric: "tabular-nums" }, box, `<span class="n">${o.from}</span><small style="font-size:50px;margin-left:12px">分钟</small>`);
    tl.set(box, { autoAlpha: 0 }, 0); tl.fromTo(box, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: "power3.out" }, o.in);
    tl.fromTo(hand, { rotation: o.from * 6 * 12 }, { rotation: o.to * 6, duration: o.dur || 1.4, ease: "power2.inOut" }, o.at);
    MU.A.count(tl, num.querySelector(".n"), o.at, { from: o.from, to: o.to, dur: o.dur || 1.4 });
    if (o.out) tl.to(box, { autoAlpha: 0, duration: 0.3 }, o.out);
    return box;
  };

  window.KX = KX;
})();
