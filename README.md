# Vantage视频剪辑Skill

把已有的口播视频，剪成带真人融合、图形解释和音效的精剪视频。

你提供口播视频，AI 根据每句话的意思设计分镜：讲数据时做数据动画，讲流程时做步骤演示，强调观点时让大字从人物身后出现。适合知识讲解、课程口播、产品教程和商业分析，支持横屏与竖屏。

## 能做什么

- **真人与动画融合**：人物后大字、人物让位、悬浮信息卡、镜头推拉。
- **把内容讲清楚**：用图表、对比、流程和真实录屏解释口播。
- **统一画面与声音**：暗色视觉、中文排版、字幕避让、动作音效和背景音乐混音。
- **交付完整工程**：成片、封面、字幕、剪辑脚本、分镜文件和动画源工程。

已有字幕会保留；无字幕时生成中英双语字幕。也可按要求导入剪映继续剪辑、导出和上传。

## 怎么用

把仓库放入 AI 工具的技能目录，文件夹命名为 `vantage-video-editing`。例如：

```bash
git clone https://github.com/Aiysae/vantage-video-editing.git ~/.codex/skills/vantage-video-editing
```

然后把视频交给 AI，说：

> 使用 Vantage视频剪辑Skill，剪辑这个口播视频。保留原声，按内容加入人物后大字、数据动画和录屏演示，交付竖屏成片、封面与源工程。先给我看剪辑脚本。

也可以把仓库交给支持读取文件、运行代码的 AI，直接让它读取 [SKILL.md](SKILL.md) 开始工作。

## 运行环境

动画使用 [HyperFrames](https://github.com/heygen-com/hyperframes)（HTML + GSAP）制作和渲染。准备 Node.js、Python 3.10+、FFmpeg，按 [HyperFrames 文档](https://hyperframes.app/docs) 安装 CLI 与浏览器。Python 辅助脚本使用 `numpy`、`soundfile`、`Pillow`、`PyYAML`；网页录屏与字号检查使用 `puppeteer-core`。

附带的 Swift 人物分割、桌面录屏和 zsh 项目初始化脚本用于 macOS。其他系统可沿用动画组件，另备人物透明视频与录屏素材。字号检查可通过 `CHROME_PATH` 指定浏览器，长片渲染可通过 `HYPERFRAMES` 指定 CLI。

背景音乐由项目提供，参考曲目与来源见 [选曲记录](sound/bgm/LICENSES.md)。可选接入 [Shotcraft 镜头库](references/shotcraft-integration.md)，扩展 124 张镜头配方卡、150 个动效样式。

## 给 AI 的入口

从 [SKILL.md](SKILL.md) 开始，按任务读取 `design/` 的视觉规则、`patterns.md` 的分镜模式、`components/` 的动画组件和 `scripts/` 的制作工具。

由 Vantage万极开源。代码与原创文档采用 [MIT License](LICENSE)，字体、图标和音效保留各自许可。
