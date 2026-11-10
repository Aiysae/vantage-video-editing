# 组件库（HyperFrames）

- `kit.css` / `kit.js`：设计系统落地。改视觉先改 `design/tokens.json`，再同步这里的 CSS 变量。
- `demo-16x9/`：横屏组件演示（占位真人）。`demo-9x16/`：竖屏演示，需要 `assets/source.mp4` 与 `assets/person.webm`。
- `fonts/`：放 Noto Sans SC 的 Black/Regular/Medium/Bold（命名需含 `-Black` 等后缀）。`scripts/new_project.sh` 会复制并生成 `fonts.css`。已附四种字重及 OFL 许可。

新项目：`scripts/new_project.sh <dir> 16x9|9x16`，然后改 `index.html` 的场景。分层与动作规则见 SKILL.md 第 4 步，模式见 patterns.md。

API 摘要（`window.MU`）：
构建 `background / hudCard / chip / chapterNav / giant / paper / windowBox / phone / msgRows / hBars / vBars / counter / dots / svg / path / brain / stamp / foot / title / subtitle`
动画 `MU.A.in / out / stagger / move / morph / count / hBars / vBars / draw / flow / fillBrain / typing / stamp / dots / giantIn / crossfade`
根节点 class：`mu-v`（竖屏字号）、`mu-light`（亮背景素材）。
