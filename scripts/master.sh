#!/bin/zsh
# 成片响度标准化（两遍 loudnorm）：-14 LUFS / -1 dBTP，视频流直接复制
# 用法: master.sh <in.mp4> <out.mp4>
set -e
if [ -z "$(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$1")" ]; then echo "无音轨: $1（跳过响度标准化；成片必须有人声音轨，请检查 <audio id> 是否接入）"; exit 2; fi
J=$(ffmpeg -hide_banner -i "$1" -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
g() { echo "$J" | python3 -c "import json,sys;print(json.load(sys.stdin)['$1'])"; }
ffmpeg -v error -y -i "$1" -c:v copy -af "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true" -ar 48000 -c:a aac -b:a 192k "$2"
"${0:A:h}/loudness.sh" "$2"
