#!/usr/bin/env python3
"""参考片音轨分析。依赖: numpy, soundfile；--separate 需要 demucs（安装前征得用户同意）。
用法:
  analyze_audio.py ref.wav --separate            # -> sep/htdemucs/ref/{vocals,no_vocals}.wav
  analyze_audio.py no_vocals.wav --onsets [--events 复刻事件清单.json] [--clips]
"""
import argparse, csv, json, subprocess, sys
from pathlib import Path
import numpy as np, soundfile as sf

def separate(p):
    subprocess.run([sys.executable, "-m", "demucs", "--two-stems=vocals", "-o", "sep", str(p)], check=True)

def onsets(p, events=None, clips=False, thresh=1.6):
    x, sr = sf.read(p, always_2d=True); m = x.mean(1)
    hop, win = 512, 2048
    n = 1 + (len(m) - win) // hop
    w = np.hanning(win)
    frames = np.lib.stride_tricks.as_strided(m, (n, win), (m.strides[0]*hop, m.strides[0]))
    S = np.abs(np.fft.rfft(frames * w, axis=1))
    flux = np.maximum(np.diff(np.log1p(S), axis=0), 0).sum(1)
    flux = np.concatenate([[0], flux])
    med = np.convolve(flux, np.ones(43)/43, mode="same")  # ~0.5s 局部中值近似
    rms = np.sqrt((frames**2).mean(1)) + 1e-9
    freqs = np.fft.rfftfreq(win, 1/sr)
    cent = (S * freqs).sum(1) / (S.sum(1) + 1e-9)
    peaks = [i for i in range(1, n-1) if flux[i] > thresh*med[i] and flux[i] >= flux[i-1] and flux[i] >= flux[i+1]]
    out, last = [], -1
    for i in peaks:
        t = i*hop/sr
        if t - last < 0.08: continue
        last = t
        # 估计时长: rms 回落到峰值 -20dB 的时间
        j = i
        while j < n-1 and 20*np.log10(rms[j]/rms[i]) > -20 and (j-i)*hop/sr < 2.5: j += 1
        out.append({"t": round(t,3), "strength": round(float(flux[i]/(med[i]+1e-9)),2),
                    "rms_db": round(float(20*np.log10(rms[i])),1), "centroid_hz": int(cent[i]),
                    "dur_est": round((j-i)*hop/sr,2)})
    ev = json.load(open(events))["events"] if events else []
    for o in out:
        best = min(ev, key=lambda e: min(abs(o["t"]-e["start_s"]), abs(o["t"]-e["end_s"])), default=None)
        if best and min(abs(o["t"]-best["start_s"]), abs(o["t"]-best["end_s"])) <= 0.5:
            o["event"] = best["id"]; o["event_title"] = best["title"]
        o["label"] = ""  # 人工听辨后填写
    dst = Path(p).with_name("onsets.csv")
    with open(dst, "w", newline="") as f:
        wr = csv.DictWriter(f, fieldnames=["t","strength","rms_db","centroid_hz","dur_est","event","event_title","label"])
        wr.writeheader(); [wr.writerow(o) for o in out]
    if clips:
        cd = Path(p).with_name("clips"); cd.mkdir(exist_ok=True)
        for k, o in enumerate(out):
            a = int(max(0, o["t"]-0.1)*sr); b = int((o["t"]+max(0.7, o["dur_est"]))*sr)
            sf.write(cd/f"{k:04d}_{o['t']:.2f}.wav", x[a:b], sr)
    print(f"{len(out)} onsets -> {dst}" + (" (+clips/)" if clips else ""))

if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("audio")
    ap.add_argument("--separate", action="store_true"); ap.add_argument("--onsets", action="store_true")
    ap.add_argument("--events"); ap.add_argument("--clips", action="store_true"); ap.add_argument("--thresh", type=float, default=1.6)
    a = ap.parse_args()
    if a.separate: separate(a.audio)
    if a.onsets: onsets(a.audio, a.events, a.clips, a.thresh)
