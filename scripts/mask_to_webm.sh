#!/bin/zsh
# 把 segment.swift 输出的 8bit 灰度 raw 遮罩 + 源视频 合成为带 alpha 的人物层 (VP9 WebM)，供 HyperFrames L3 使用
# 用法: mask_to_webm.sh <source.mp4> <masks.raw> <mask_w> <mask_h> <out.webm> [feather_px=2]
set -e
SRC="$1"; RAW="$2"; MW="$3"; MH="$4"; OUT="$5"; F="${6:-2}"
INFO=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height,avg_frame_rate -of csv=p=0:s=x "$SRC")
W=${INFO%%x*}; REST=${INFO#*x}; H=${REST%%x*}; FPS=${REST#*x}
ffmpeg -v error -y -i "$SRC" -f rawvideo -pix_fmt gray -s ${MW}x${MH} -framerate "$FPS" -i "$RAW" \
  -filter_complex "[1:v]scale=${W}:${H}:flags=bicubic,gblur=sigma=${F}[m];[0:v]format=yuva420p[v];[v][m]alphamerge[o]" \
  -map "[o]" -an -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 24 -row-mt 1 -auto-alt-ref 0 "$OUT"
echo "wrote $OUT (${W}x${H} @ $FPS)  -- 检查: 遮罩方向/尺寸需与源一致，竖屏注意 rotate"
