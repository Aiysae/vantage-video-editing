#!/usr/bin/env python3
"""分段渲染长片（16GB 内存的机器上，整片一次渲染会在约 4800 帧后内存抖动、卡死）。
把 index.html 切成每段 N 秒的 chunkK.html（视频 data-media-start 加偏移、去掉 <audio>、用显式 seek 包一层时间线），
逐段 `hyperframes render -c`，最后无损拼接。声音另做（vo+sfx+bgm 混音），拼接后再 mux。
用法: render_chunks.py <project_dir> <out.mp4> [--len 64] [--workers 2] [--tmp 外置盘临时目录] [--only 0,3]
注意:
 - 必须用显式 seek 包装（tl.seek），不要用 tl.tweenFromTo：后者从 0 开始时会跳过 0 秒处的 set，开场元素会丢失（2026-10-03 实测）。
 - TMPDIR 指到外置盘：抽帧中间文件几十 GB。
 - 从会话外的终端运行（Claude Code 会话结束会 SIGTERM 子进程，hyperframes 检测到父进程退出也会自取消）。
"""
import argparse, os, re, subprocess, sys, shutil
from pathlib import Path
ap = argparse.ArgumentParser(); ap.add_argument("proj"); ap.add_argument("out"); ap.add_argument("--len", type=float, default=64.0)
ap.add_argument("--workers", default="2"); ap.add_argument("--tmp"); ap.add_argument("--only"); ap.add_argument("--quality", default="delivery")
a = ap.parse_args(); P = Path(a.proj).resolve(); src = (P / "index.html").read_text()
m = re.search(r'data-composition-id="([^"]+)"[^>]*data-duration="([\d.]+)"', src); cid, T = m.group(1), float(m.group(2))
hf = os.environ.get("HYPERFRAMES") or shutil.which("hyperframes") or next(iter(sorted(Path.home().glob(".npm/_npx/*/node_modules/.bin/hyperframes"))), None)
env = dict(os.environ); 
if a.tmp: env["TMPDIR"] = a.tmp.rstrip("/") + "/"
outdir = Path(a.out).resolve().parent / "chunks"; outdir.mkdir(exist_ok=True)
offs = []; o = 0.0
while T - o > 1e-6:
    ln = a.len if T - o - a.len > a.len * 0.25 else T - o  # 尾段太短就并进上一段
    offs.append((o, round(ln, 3))); o += ln
only = set(int(x) for x in a.only.split(",")) if a.only else None
parts = []
for k, (off, ln) in enumerate(offs):
    s = re.sub(r'(data-composition-id="%s"[^>]*data-duration=")[\d.]+' % re.escape(cid), r'\g<1>%s' % ln, src, count=1)
    def media(mm):
        tag = mm.group(0); ms = float(re.search(r'data-media-start="([\d.]+)"', tag).group(1)) if 'data-media-start' in tag else 0.0
        tag = re.sub(r'data-duration="[\d.]+"', f'data-duration="{ln}"', tag)
        return re.sub(r'data-media-start="[\d.]+"', f'data-media-start="{round(ms + off, 3)}"', tag) if 'data-media-start' in tag else tag.replace("<video ", f'<video data-media-start="{off}" ')
    s = re.sub(r'<video [^>]*>', media, s)
    s = re.sub(r'\s*<audio [^>]*></audio>', '', s)
    s = s.replace(f'window.__timelines["{cid}"] = tl;', f'const wrap = gsap.timeline({{ paused: true }}); const pr = {{ t: {off} }}; tl.seek({off}, false); '
                  f'wrap.to(pr, {{ t: {round(off + ln, 3)}, duration: {ln}, ease: "none", onUpdate: () => tl.seek(pr.t, false) }}, 0); window.__timelines["{cid}"] = wrap;')
    assert "wrap.to(pr" in s, "index.html 必须以 window.__timelines[id] = tl; 注册主时间线"
    f = P / f"chunk{k}.html"; f.write_text(s); out = outdir / f"c{k}.mp4"; parts.append(out)
    if (only is not None and k not in only) or (only is None and out.exists() and out.stat().st_size > 0): continue
    print(f"chunk {k}: {off}+{ln}s", flush=True)
    r = subprocess.run([str(hf), "render", "-c", f.name, "-o", str(out), "-q", a.quality, "-w", a.workers, "--quiet"], cwd=P, env=env)
    if r.returncode: sys.exit(f"chunk {k} 失败")
for k in range(len(offs)): (P / f"chunk{k}.html").unlink(missing_ok=True)  # 多根文件会让 lint 报 multiple_root_compositions
lst = outdir / "concat.txt"; lst.write_text("".join(f"file '{p}'\n" for p in parts))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", a.out], check=True)
print("done ->", a.out)
