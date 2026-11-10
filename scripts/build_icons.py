#!/usr/bin/env python3
"""把 components/icons/{brands,lucide}/*.svg 打包成 components/icons/icons.js（window.MU_ICONS），渲染时无需网络/异步加载。
新增图标：
  品牌（Simple Icons, CC0）：curl -o components/icons/brands/<slug>.svg https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/<slug>.svg
  概念（Lucide, ISC）：     curl -o components/icons/lucide/<name>.svg https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/<name>.svg
  Simple Icons 没有的品牌（飞书、剪映、豆包等）：从品牌官网/新闻资料包取官方 SVG 或 PNG，放 brands/<slug>.svg|png，并在 brands/SOURCES.md 记来源。
然后重跑本脚本。"""
import json, re
from pathlib import Path
D = Path(__file__).resolve().parent.parent / "components/icons"
meta = json.loads((D / "brands/brands.json").read_text()) if (D / "brands/brands.json").exists() else {}
out = {"brands": {}, "lucide": {}}
for f in sorted((D / "brands").glob("*.svg")):
    svg = re.sub(r"<title>.*?</title>", "", f.read_text())
    m = meta.get(f.stem, {})
    out["brands"][f.stem] = {"svg": svg, "title": m.get("title", f.stem), "hex": m.get("hex", "#ffffff")}
for f in sorted((D / "brands").glob("*.png")):
    import base64
    m = meta.get(f.stem, {})
    out["brands"][f.stem] = {"png": "data:image/png;base64," + base64.b64encode(f.read_bytes()).decode(), "title": m.get("title", f.stem), "hex": m.get("hex", "#ffffff")}
for f in sorted((D / "lucide").glob("*.svg")):
    out["lucide"][f.stem] = re.sub(r"<!--.*?-->", "", f.read_text(), flags=re.S).strip()
(D / "icons.js").write_text("window.MU_ICONS = " + json.dumps(out, ensure_ascii=False) + ";\n")
print(f"brands {len(out['brands'])}, lucide {len(out['lucide'])} -> {D/'icons.js'}")
