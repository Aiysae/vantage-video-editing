# Shotcraft 镜头库接入

入口是 `vantage-video-editing`。它负责口播理解、整片节奏、真人融合、声音与交付；Shotcraft 提供选镜、动作配方和参考实现。使用某张卡时读取对应资源即可，无需启动上游完整的产品宣传片流程。

## 资源与查询

可选安装（在技能的同级目录执行）：

```bash
git clone https://github.com/Vincentwei1021/video-shotcraft.git
git -C video-shotcraft checkout 1266a3ec4831289c4d893d42dd5102723658039a
```

上游目录：相对本文件 `../../video-shotcraft/`。来源为 `https://github.com/Vincentwei1021/video-shotcraft`，本次固定提交 `1266a3ec4831289c4d893d42dd5102723658039a`。保留上游 LICENSE、素材许可与署名文件，原库保持独立；项目复制实际用到的源码、依赖和素材，记录来源与修改。

- `gallery/api/library.json`：124 张卡、150 个有效 style-key，含用途、动作意图、能量、时长、变体描述。
- `references/shots/`：动作阶段、参数、命门、参考实现。
- `demos/`、`assets/lib/`：可复用源码及其依赖；`_legacy` 不在本次有效库内。
- `gallery/media/`：150 个本地 MP4 动态预览。
- 本目录 `shotcraft-usage.json`：150 个样式的本地标签、准确实现入口、预览路径、建议实现方式及验证范围。路径除 `source.root` 外，均相对上游目录；验证证据路径相对记录的项目目录。

按需查询，避免把整份源码和清单一次装进上下文。以下示例从用途、动作、变体描述与本地标签共同检索，并输出具体变体：

```python
import json
from pathlib import Path
root = Path.home() / '.codex/skills'
library = json.loads((root/'video-shotcraft/gallery/api/library.json').read_text())
usage = json.loads((root/'vantage-video-editing/references/shotcraft-usage.json').read_text())
cards = {c['name']: c for c in library['cards']}
terms = ['汇聚', '资料', '来源']  # 换成当前句子的对象与视觉动词
for row in usage['styles']:
    card = cards[row['card']]
    style = next(s for s in card['styles'] if s['key'] == row['style'])
    text = ' '.join([card['use'], card['summary'], card['intention'],
                     style['description'], *row['usage_tags']])
    if any(term in text for term in terms):
        print(row['card'], row['style'], row['recipe'], row['implementation_sources'],
              row['preview'], row['preferred_implementation'], row['validation'])
```

查不到精确词时，用视觉动词、近义词和 `patterns.md` 的用途入口扩大检索，再读卡片判断。标签帮助发现候选，不表示每个同类镜头都适合本句。缺失资源或版本不一致时明确记录，先用现有模式完成其他段落，不将缺失样式标为已验证；更新上游版本是另一次维护，不在制作视频时自动拉取改库。

## 选镜与节奏

1. 按现有语义五问明确对象、动作、结果；选择真人/HUD/身后/真实素材舞台/全屏解释的角色。
2. 检索所有有效样式，比较其用途、能量、时长、素材需求、中文与画幅成本；与现有模式一起选择。
3. 读取所选卡片、该 `style-key` 的实现和预览。多变体卡按清单定位，避免把同卡另一个变体当作本镜头。`crash-zoom-punch` 的配方列出回弹和冲击两份实现，使用前按预览及本句决定，工程明确选中的文件。上游信息冲突记录在条目的 `upstream_notes`；本次发现 `tilt-reveal` 的 Gallery 概述与其卡片正文、准确源码和预览不一致，样片使用后三者一致的 86° / 20f+40f+10f 动作，并保留冲突记录。
4. 记录视觉峰值所对应的口播词、进入/主动作/停留/退出、跨场 `obj_id`。相邻段落避免反复同一种入场、同一类镜头旅行；解释段留出阅读停留，高潮依旧服从原有 L0–L4 预算。
5. 不把演示数据、样例品牌或样片里的页面当成本片事实。替换为真实截图、录屏、用户已有对象；抽象关系和数量示意要有明确依据。

storyboard 示例（时间、语义和音效仍用原字段）：

```json
{
  "obj_id": "ip-heading",
  "shotcraft": {
    "card": "title-demote-to-label",
    "style": "title-demote-to-label",
    "implementation": "hyperframes-adapt",
    "source": "demos/typography/title-demote-to-label/TitleDemoteToLabel.tsx"
  }
}
```

## 两种制作入口

**HyperFrames 适配**：适合普通文字、卡片、路径、计数和轻量运镜。先复用 MU / KX / FX，再按准确源码补齐本镜头需要的关键动作。保留阶段顺序、缓动、遮罩时机、主次关系；允许因口播拉长阅读停留，避免整体倍速压缩。写明适配差异，不把“借用了名字”算作该配方的实现。

**Remotion 分镜素材**：复杂透视、空间相机、逐帧绘制或专用组件优先保留上游实现。复制准确 TSX 及递归 import 的共享组件、纹理、字体到本项目，按上游依赖版本配置；替换内容与品牌后独立渲染。主片以本地 `<video>` 加入对应 `data-start/data-duration/data-media-start`，声音仍归主片统一混音。渲后检查首中尾、接缝、真实素材纹理和时长映射。不得把 Gallery 预览直接当作本片定制成品。

使用整幅背景的镜头放在 graphic 层；需要 behind/front 分层时输出可拆图层或真正带 alpha 的素材，并在渲染产物上确认透明支持。黑底 MP4 不能充当透明人物前景。

## 适配要求

- 上游多数为 1920×1080、30fps。按本片实际 fps 换算帧数，统一秒时间；不要直接把 30fps 的 frame 索引当 60fps 使用。
- 中文用本技能字体与字号下限，按实际字宽换行。逐字动画、字形穿越、槽位轮换尤其要重测，不沿用写死的英文字宽。
- 竖屏重排主体、相机路径、字幕区和人物槽位；截图可裁取真实重点，但不得靠裁掉标题、关系节点或数据标签来塞进画幅。
- 颜色、背景、字体、字幕安全区以本技能 tokens/layout 为准。保留镜头的动作语法，不复制无关样例美术。
- 人物融合检查头发/手臂遮挡、面部避让；记录图形位于 behind/front/HUD/graphic 哪层。
- 数据用同一个 progress 驱动图形与数字；画面只有分类关系时使用分类图，不凭空添加增长率或统计结论。
- 音效建议只是候选，沿用本技能现有授权素材、稀疏音效与混音规则；不因多一个镜头增加一次响声。

## 验证状态与验收

`validation.resources=verified` 仅表示配方、准确实现入口和预览存在，媒体信息探测通过。每个画幅独立标记 `reference-only`（原始参考）、`adapted`（已制作、待渲染检查）或 `rendered`（该项目已渲染检查），附工程与检查记录。记录 `rendered` 不代表任意字幕、人物、内容都自动合格；下一片仍要检查其实际素材与版式。

选中样式逐项验证：动作是否忠于指定变体、中文清晰和字号合格、人物/字幕避让、数据有据、峰值对齐、阅读停留、相邻镜头连续、媒体实际播放、声音与解码。资源清点、静帧检查、动态输出、人工听审分别记账。只更新实际有证据的样式和画幅；其余仍保持 `reference-only`。
