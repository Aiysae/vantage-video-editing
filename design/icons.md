# 实体用图标表达（用户 2026-10-03 确认）

**规则：口播里出现一个“有公认形象的东西”，画面就用它的形象，再配名字；不要只写文字。** GitHub 只是例子，要举一反三。

| 实体类型 | 例子 | 用什么 | 来源 |
|---|---|---|---|
| 产品 / 平台 / 公司 | GitHub、Claude、ChatGPT、Notion、Figma、YouTube、抖音、B站、微信、Python | 官方图形（logo mark）＋名称 | Simple Icons（CC0），`components/icons/brands/` |
| Simple Icons 没收录的品牌 | 飞书、剪映、豆包、Kimi、钉钉等 | 官方图形 | 品牌官网 / 新闻资料包 / 应用商店图标；放 `brands/<slug>.svg|png`，在 `brands/SOURCES.md` 记来源 |
| 软件界面 / 具体功能 | “飞书妙记的转写页面”“GitHub 仓库页” | 真实截图（用户提供或自行截取）放进设备框 | 用户素材；不得伪造界面 |
| 通用概念 | 文档、链接、仓库、Agent、终端、数据库、搜索、灯泡、时钟、日历、用户 | 线性概念图标 | Lucide（ISC），`components/icons/lucide/` |
| 文件 / 格式 | Markdown、PDF、JSON | 品牌图形（有则用）或 `file-text` 图标＋扩展名 | 同上 |

## 用法

- 组件：`MU.brand(parent, {slug, label, size})` 生成“图标卡＋名称”；`MU.icon(parent, {name, size, color})` 生成概念图标；`MU.inlineBrand(slug)` / `MU.inlineIcon(name)` 嵌在文字前。
- 新增图标后运行 `scripts/build_icons.py` 重新打包 `icons/icons.js`（渲染时不走网络）。
- 首次出现：图标卡放大入场（back.out）＋名称稍后出现；之后同一实体在 HUD、流程图中用小号图标复现，保持同一形象。
- 关系表达用“图标 → 连线/流点 → 图标”（例：GitHub 仓库 → 链接 → 你的 Agent），而不是一行文字。

## 品牌图形的规矩

- 只用于**指代**该产品（说明、教程、对比），不暗示合作或背书；不改造、不拉伸、不重新配色成别的颜色、不和其他元素拼成新标志。
- 配色：品牌主色很暗（GitHub、Notion、TikTok 等）→ 白色图形放深色图标卡；有色品牌（Claude 橙、YouTube 红、微信绿）→ 用官方色。`MU.brand` 会自动判断。
- 不用 Emoji、3D 卡通图标；概念图标统一 Lucide 线性风格（描边 1.6–1.8）。
