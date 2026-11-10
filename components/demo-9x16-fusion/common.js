/* 四个样片共用：字幕（源 3.7–11.7s → 成片 0–8s）与工具 */
window.SUBS = [
  [0.15, 1.55, "把这套经验整理成 Skill", "Package your know-how into a Skill."],
  [1.6, 3.48, "配好使用说明和使用案例", "Add instructions and examples."],
  [3.52, 4.65, "直接发布到 GitHub", "Then publish it straight to GitHub."],
  [5.1, 6.62, "别人拿到仓库链接", "Anyone with the repo link"],
  [6.66, 7.95, "也可以交给自己的 Agent", "can hand it to their own Agent."]];
window.addSubs = function (tl, host, top) {
  SUBS.forEach(([a, b, cn, en]) => { const s = MU.subtitle(host, { cn, en, top: top || 1400 });
    tl.set(s, { autoAlpha: 0 }, 0); tl.set(s, { autoAlpha: 1 }, a); tl.set(s, { autoAlpha: 0 }, b); });
};
