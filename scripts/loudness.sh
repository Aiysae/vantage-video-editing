#!/bin/zsh
# 用法: loudness.sh <media>   输出整体响度(LUFS)、真峰值(dBTP)、LRA
ffmpeg -hide_banner -nostats -i "$1" -af ebur128=peak=true -f null - 2>&1 | awk '/Summary/{f=1} f' | grep -E "I:|LRA:|Peak:" 
echo "目标: I ≈ -14 LUFS, Peak ≤ -1.0 dBTP"
