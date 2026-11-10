#!/usr/bin/env python3
"""按 storyboard.json 的 sfx 列表，从 sound/library 取样排布成 sfx.wav（48k/24bit 立体声）。
storyboard: {"scenes":[{"sfx":[{"t":12.34,"cat":"pop","pan":-0.15,"gain":null}, ...]}, ...]}
  t = 成片时间（视觉峰值帧）；gain = 相对人声的 dB（null 用 sfx-map 默认）
用法: sfx_layout.py storyboard.json <library_dir> <duration_s> out.wav --voice vo.wav
  --voice: 人声参考（成片人声轨）。音效按“样本有效段 RMS = 人声说话段中位 RMS + gain”定标，与参考片测量口径一致。"""
import argparse, json, random
from pathlib import Path
import numpy as np, soundfile as sf
ap = argparse.ArgumentParser(); ap.add_argument("sb"); ap.add_argument("lib"); ap.add_argument("dur", type=float); ap.add_argument("out"); ap.add_argument("--voice", required=True)
a = ap.parse_args(); lib = Path(a.lib)
cfg = json.load(open(Path(__file__).resolve().parent.parent / "sound/sfx-map.json"))["categories"]
SR = 48000
def rms_db(x): return 20*np.log10(np.sqrt((x**2).mean())+1e-12)
v, vsr = sf.read(a.voice, always_2d=True); vm = v.mean(1); h = int(vsr*0.4)
vw = [rms_db(vm[i:i+h]) for i in range(0, len(vm)-h, h)]; vw = [d for d in vw if d > max(vw)-25]
vref = float(np.median(vw)); print(f"voice reference RMS {vref:.1f} dBFS")
mix = np.zeros((int(a.dur*SR)+SR, 2), np.float32); rng = random.Random(7); last = {}; missing = set()
cues = []
for c in [c for s in json.load(open(a.sb))["scenes"] for c in s.get("sfx", [])]:
    if c["cat"] == "tick_roll":  # 连续计数：按 dur 展开成渐快渐弱的 tick 串
        d = c.get("dur", 1.2); t = 0.0; k = 0
        while t < d:
            g = (c.get("gain") if c.get("gain") is not None else cfg["tick_roll"]["gain"]) - 6*t/d
            cues.append({"t": c["t"]+t, "cat": "tick_roll", "pan": c.get("pan", 0), "gain": g}); k += 1; t += max(0.045, 0.11 - 0.008*k)
    else: cues.append(c)
def folder(cat): return cfg[cat]["files"].split("/")[1] if cat in cfg else cat
for c in sorted(cues, key=lambda c: c["t"]):
    cat = c["cat"]; files = sorted((lib/folder(cat)).glob("*.wav"))
    if not files: missing.add(cat); continue
    pool = [f for f in files if f != last.get(cat)] or files; f = rng.choice(pool); last[cat] = f
    x, sr = sf.read(f, always_2d=True, dtype="float32")
    if sr != SR:
        idx = np.arange(0, len(x), sr/SR); x = np.stack([np.interp(idx, np.arange(len(x)), x[:, k]) for k in range(x.shape[1])], 1)
    if x.shape[1] == 1: x = np.repeat(x, 2, 1)
    if cat == "tick_roll":  # 计数 tick 只取起音 60ms，避免长样本叠成噪声墙
        x = x[:int(0.06*SR)].copy(); x[-int(0.02*SR):] *= np.linspace(1, 0, int(0.02*SR))[:, None]
    env = np.abs(x).mean(1); act = x[env > env.max()*0.1]
    gain = c.get("gain") if c.get("gain") is not None else cfg[cat]["gain"]
    x = x * 10**((vref + gain - rms_db(act)) / 20)
    pan = c.get("pan", 0); x = x * np.array([1-max(pan, 0), 1+min(pan, 0)], np.float32)
    off = cfg[cat]["offset"] if isinstance(cfg[cat]["offset"], (int, float)) else -len(x)/SR
    p = max(0, int((c["t"]+off)*SR)); e = min(len(mix), p+len(x)); mix[p:e] += x[:e-p]
peak = np.abs(mix).max()
if peak > 0.89: mix *= 0.89/peak; print("warning: sfx bus limited")
sf.write(a.out, mix[:int(a.dur*SR)], SR, subtype="PCM_24")
print(f"{len(cues)} cues -> {a.out}" + (f"  缺少素材类别: {sorted(missing)}" if missing else ""))
