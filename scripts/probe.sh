#!/bin/zsh
# 用法: probe.sh <video> [outdir]
# 输出: 基本参数、建议 layout、底部区域抽帧（目视确认是否有烧录字幕）、人物位置抽帧
set -e
V="$1"; OUT="${2:-./probe}"; mkdir -p "$OUT"
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,avg_frame_rate:stream_tags=rotate -show_entries format=duration -of json "$V" > "$OUT/probe.json"
ffprobe -v error -select_streams a -show_entries stream=index,codec_name,sample_rate,channels -of csv=p=0 "$V" > "$OUT/audio.txt" || true
ffprobe -v error -select_streams s -show_entries stream=index,codec_name -of csv=p=0 "$V" > "$OUT/subtitle_streams.txt" || true
python3 - "$OUT/probe.json" <<'PY'
import json,sys
d=json.load(open(sys.argv[1]));s=d["streams"][0];w,h=s["width"],s["height"]
rot=int((s.get("tags") or {}).get("rotate",0) or 0)
if rot in (90,270): w,h=h,w
dur=float(d["format"]["duration"]);fps=s["avg_frame_rate"]
print(f"size={w}x{h} duration={dur:.2f}s fps={fps} layout={'16x9' if w>=h else '9x16'}")
PY
echo "audio: $(cat $OUT/audio.txt | tr '\n' ' ')"; echo "embedded subtitle streams: $(cat $OUT/subtitle_streams.txt | wc -l | tr -d ' ')"
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$V")
# 6 帧全画面 + 底部 30% 条带拼图
ffmpeg -v error -y -i "$V" -vf "fps=6/$D,scale=480:-2,tile=3x2" -frames:v 1 "$OUT/frames.jpg"
ffmpeg -v error -y -i "$V" -vf "fps=12/$D,crop=iw:ih*0.3:0:ih*0.7,scale=720:-2,tile=1x12" -frames:v 1 "$OUT/bottom-strips.jpg"
echo "check: $OUT/frames.jpg (人物位置)  $OUT/bottom-strips.jpg (是否有烧录字幕)"
