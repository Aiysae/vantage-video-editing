/* fx.js —— 画面质感升级层（镜头、景深、运动模糊、3D、光、颗粒）。依赖 GSAP 与 kit.js，全部确定性、可 seek。 */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const FX = {};

  // ---------- 虚拟镜头：world 在 camera 视窗里移动；唯一写入者，叠加 sine 微漂移 ----------
  // keys: [{t, dur, x, y, s, ease}]  —— x/y 为“镜头对准的 world 坐标”，s 为缩放
  FX.camera = function (tl, world, view, first, keys, o = {}) {
    const pose = { x: first.x, y: first.y, s: first.s }, drift = { p: 0 };
    const amp = o.drift == null ? 6 : o.drift;
    const write = () => {
      const dx = Math.sin(drift.p) * amp, dy = Math.sin(drift.p * 1.3) * amp * 0.7;
      const tx = view.w / 2 - pose.x * pose.s + dx, ty = view.h / 2 - pose.y * pose.s + dy;
      world.style.transform = `translate(${tx}px, ${ty}px) scale(${pose.s})`;
    };
    world.style.transformOrigin = "0 0"; write();
    keys.forEach((k) => tl.to(pose, { x: k.x, y: k.y, s: k.s, duration: k.dur, ease: k.ease || "power3.inOut", onUpdate: write }, k.t));
    tl.to(drift, { p: Math.PI * 2 * (o.cycles || 1), duration: o.total || 8, ease: "none", onUpdate: write }, 0);
    return pose;
  };

  // ---------- 运动模糊：SVG 定向高斯；leg() 在移动窗口内 0→峰→0 ----------
  FX.blurFilter = function (host, id) {
    const s = document.createElementNS(NS, "svg"); s.setAttribute("width", 0); s.setAttribute("height", 0); s.style.position = "absolute";
    s.innerHTML = `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="0 0"/></filter>`;
    host.appendChild(s); const node = s.querySelector("feGaussianBlur"); const st = { x: 0, y: 0 };
    const w = () => node.setAttribute("stdDeviation", `${st.x.toFixed(2)} ${st.y.toFixed(2)}`);
    return { url: `url(#${id})`, leg(tl, t, dur, peakX, peakY) {
      tl.to(st, { x: peakX, y: peakY, duration: dur * 0.45, ease: "power2.in", onUpdate: w }, t);
      tl.to(st, { x: 0, y: 0, duration: dur * 0.55, ease: "power2.out", onUpdate: w }, t + dur * 0.45);
    } };
  };

  // ---------- 景深：对非焦点元素加模糊+压暗 ----------
  FX.dof = function (tl, els, t, px, dim, dur) {
    els.forEach((e) => tl.to(e, { filter: `blur(${px}px)`, opacity: dim, duration: dur || 0.5, ease: "power2.inOut" }, t));
  };
  FX.focus = function (tl, els, t, dur) { els.forEach((e) => tl.to(e, { filter: "blur(0px)", opacity: 1, duration: dur || 0.5, ease: "power2.inOut" }, t)); };

  // ---------- 光：主光源、暗角、泛光、扫光 ----------
  FX.keyLight = function (parent, o = {}) {
    const d = document.createElement("div");
    Object.assign(d.style, { position: "absolute", inset: "0", pointerEvents: "none",
      background: `radial-gradient(ellipse ${o.w || "70%"} ${o.h || "55%"} at ${o.x || "50%"} ${o.y || "35%"}, ${o.color || "rgba(120,190,230,0.16)"} 0%, rgba(0,0,0,0) 70%)` });
    parent.appendChild(d); return d;
  };
  FX.vignette = function (parent, strength) {
    const d = document.createElement("div");
    Object.assign(d.style, { position: "absolute", inset: "0", pointerEvents: "none", zIndex: 50,
      background: `radial-gradient(ellipse 80% 75% at 50% 48%, rgba(0,0,0,0) 55%, rgba(0,0,0,${strength || 0.55}) 100%)` });
    parent.appendChild(d); return d;
  };
  FX.glow = function (parent, o) {
    const g = document.createElement("div");
    Object.assign(g.style, { position: "absolute", left: o.x - o.w / 2 + "px", top: o.y - o.h / 2 + "px", width: o.w + "px", height: o.h + "px",
      borderRadius: "50%", background: `radial-gradient(closest-side, ${o.color || "rgba(102,212,242,0.55)"}, rgba(0,0,0,0))`, filter: "blur(20px)", opacity: 0, pointerEvents: "none" });
    parent.insertBefore(g, o.before || parent.firstChild); return g;
  };
  FX.bloom = function (tl, g, t, peak) {
    tl.fromTo(g, { opacity: 0, scale: 0.6 }, { opacity: peak || 0.45, scale: 1, duration: 0.7, ease: "power2.out" }, t);
  };
  FX.sweep = function (tl, el, t, o = {}) {
    el.style.overflow = "hidden"; if (getComputedStyle(el).position === "static") el.style.position = "relative";
    const b = document.createElement("div");
    Object.assign(b.style, { position: "absolute", top: "-20%", left: "0", width: (o.w || 140) + "px", height: "140%", pointerEvents: "none",
      background: "linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0) 100%)", transform: "skewX(-18deg)", zIndex: 5 });
    el.appendChild(b);
    tl.fromTo(b, { x: -(o.w || 140) * 1.5, opacity: 1 }, { x: el.offsetWidth + (o.w || 140), duration: o.dur || 0.9, ease: "power1.inOut" }, t);
    tl.set(b, { opacity: 0 }, t + (o.dur || 0.9));
  };

  // ---------- 胶片颗粒：每帧确定性偏移 ----------
  FX.grain = function (parent, tl, total, o = {}) {
    const d = document.createElement("div");
    Object.assign(d.style, { position: "absolute", inset: "-64px", pointerEvents: "none", zIndex: 60, backgroundImage: "url(grain.png)",
      backgroundSize: "512px 512px", mixBlendMode: "overlay", opacity: String(o.opacity || 0.12) });
    parent.appendChild(d);
    const st = { f: 0 };
    tl.to(st, { f: Math.round(total * 30), duration: total, ease: "none", onUpdate: () => {
      const f = Math.floor(st.f); const x = (f * 7919) % 512, y = (f * 104729) % 512; d.style.backgroundPosition = `${x}px ${y}px`; } }, 0);
    return d;
  };

  // ---------- 3D 舞台 ----------
  FX.stage3d = function (parent, perspective) {
    parent.style.perspective = (perspective || 1600) + "px"; parent.style.perspectiveOrigin = "50% 42%";
    const s = document.createElement("div"); Object.assign(s.style, { position: "absolute", inset: "0", transformStyle: "preserve-3d" });
    parent.appendChild(s); return s;
  };

  window.FX = FX;
})();
