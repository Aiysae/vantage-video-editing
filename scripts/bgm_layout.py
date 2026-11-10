#!/usr/bin/env python3
"""铺背景音乐：按人声电平定标（默认比人声低 15.5 dB，参考片实测），曲子不够长时 2 秒交叉淡化循环，
头 1 秒淡入、尾 2 秒淡出；人声停顿 > 0.8s 时音乐回升 3 dB（0.3s 起、0.5s 落）。
用法: bgm_layout.py <hazy-after-hours|deep-urban|文件路径> <voice.wav> <duration_s> <out.wav> [--rel -15.5] [--start 秒] [--no-lift] [--mark-used]
选曲规则见 sound/bgm/rotation.json；--mark-used 记录本次用曲，下一条视频优先换另一首。"""
import argparse, json, subprocess
from pathlib import Path
import numpy as np, soundfile as sf
SR = 48000; BGM = Path(__file__).resolve().parent.parent / "sound/bgm"
ap = argparse.ArgumentParser()
ap.add_argument("track"); ap.add_argument("voice"); ap.add_argument("dur", type=float); ap.add_argument("out")
ap.add_argument("--rel", type=float, default=-15.5); ap.add_argument("--start", type=float)
ap.add_argument("--no-lift", action="store_true"); ap.add_argument("--mark-used", action="store_true")
a = ap.parse_args()
rot = json.loads((BGM / "rotation.json").read_text())
meta = rot["tracks"].get(a.track)
path = BGM / meta["file"] if meta else Path(a.track)
start = a.start if a.start is not None else (meta or {}).get("start_at_s", 0)
def load(p):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(p), "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()
def rms(x): return float(np.sqrt((x ** 2).mean()) + 1e-12)
m = load(path); v = load(a.voice).mean(1)
N = int(a.dur * SR); xf = int(2.0 * SR)
src = m[int(start * SR):]
out = src.copy()
while len(out) < N:  # 交叉淡化循环
    t = np.linspace(0, 1, xf, dtype=np.float32)[:, None]
    out[-xf:] = out[-xf:] * (1 - t) + src[:xf] * t
    out = np.concatenate([out, src[xf:]])
out = out[:N]
h = int(SR * 0.4); w = [20 * np.log10(rms(v[i:i + h])) for i in range(0, len(v) - h, h)]
w = [d for d in w if d > max(w) - 25]; vref = float(np.median(w))
act = out[np.abs(out).mean(1) > np.abs(out).mean() * 0.3]
g = 10 ** ((vref + a.rel - 20 * np.log10(rms(act))) / 20)
env = np.full(N, g, np.float32)
if not a.no_lift:  # 人声停顿时回升 3 dB
    hop = int(0.05 * SR); n = N // hop + 1
    speak = np.array([rms(v[i * hop:(i + 1) * hop]) if i * hop < len(v) else 0.0 for i in range(n)])
    quiet = speak < 10 ** ((vref - 18) / 20); tgt = np.ones(n); run = 0
    for i, q in enumerate(quiet):
        run = run + 1 if q else 0
        if run * 0.05 > 0.8: tgt[i - run + 1:i + 1] = 10 ** (3 / 20)
    sm = np.empty(n); cur = 1.0
    for i, t in enumerate(tgt):
        cur += (t - cur) * min(1, 0.05 / (0.3 if t > cur else 0.5)); sm[i] = cur
    env *= np.repeat(sm, hop)[:N].astype(np.float32)
fi, fo = int(1.0 * SR), int(2.0 * SR)
env[:fi] *= np.linspace(0, 1, fi); env[-fo:] *= np.linspace(1, 0, fo)
sf.write(a.out, out * env[:, None], SR, subtype="PCM_24")
print(f"bgm {path.name} from {start}s, {a.rel} dB vs voice ({vref:.1f} dBFS) -> {a.out}")
if a.mark_used and meta:
    rot["last_used"] = a.track; (BGM / "rotation.json").write_text(json.dumps(rot, ensure_ascii=False, indent=2))
