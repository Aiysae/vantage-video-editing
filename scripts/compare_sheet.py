#!/usr/bin/env python3
"""并排对照：左=参考片帧，右=本片帧，每行一对，带标签。依赖 Pillow。
用法: compare_sheet.py out.jpg ref1.jpg:mine1.jpg[:标签] ref2.jpg:mine2.jpg[:标签] ...
参考帧可以是 reference-8980 下的整帧图；从 fine/sheet-*.jpg 取格子时先自行裁切。"""
import sys
from PIL import Image, ImageDraw, ImageFont
W = 960
def load(p):
    im = Image.open(p).convert("RGB"); return im.resize((W, int(im.height*W/im.width)))
def font(s):
    for f in [str(__import__("pathlib").Path(__file__).resolve().parents[1] / "components/fonts/NotoSansSC-Bold.otf"), "/System/Library/Fonts/Hiragino Sans GB.ttc"]:
        try: return ImageFont.truetype(f, s)
        except OSError: pass
    return ImageFont.load_default()
rows = []
for arg in sys.argv[2:]:
    parts = arg.split(":"); a, b = load(parts[0]), load(parts[1]); lab = parts[2] if len(parts) > 2 else ""
    h = max(a.height, b.height) + 44
    r = Image.new("RGB", (W*2+12, h), "#111"); r.paste(a, (0, 44)); r.paste(b, (W+12, 44))
    d = ImageDraw.Draw(r); d.text((10, 8), "参考 " + lab, fill="#9ad", font=font(24)); d.text((W+22, 8), "本片 " + lab, fill="#fd6", font=font(24))
    rows.append(r)
out = Image.new("RGB", (W*2+12, sum(r.height+12 for r in rows)), "#000"); y = 0
for r in rows: out.paste(r, (0, y)); y += r.height+12
out.save(sys.argv[1], quality=88); print("wrote", sys.argv[1])
