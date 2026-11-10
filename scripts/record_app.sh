#!/bin/zsh
# 桌面软件录屏：只录目标应用最前面那个窗口所在的矩形区域（不录整个桌面）。
# 用法: record_app.sh "<应用名，如 剪映专业版 / Google Chrome / 飞书>" <秒数> <out.mov> [--clicks]
# 前提：本机已授予“屏幕录制”和“辅助功能”权限（2026-10-03 已授予）。录制期间由 Claude 用辅助功能/模拟点击操作该应用。
# 注意：录的是屏幕区域——录前把该窗口置顶、关掉通知（勿扰模式），并确认窗口内没有与教程无关的私人信息（聊天、账号、文件名）。
set -e
APP="$1"; SECS="$2"; OUT="$3"; CLK=""; [ "$4" = "--clicks" ] && CLK="-k"
osascript -e "tell application \"$APP\" to activate" >/dev/null 2>&1 || true
sleep 0.6
B=$(osascript -e "tell application \"System Events\" to tell (first process whose name is \"$APP\" or displayed name is \"$APP\") to get {position, size} of front window" 2>/dev/null | tr -d ' ')
[ -z "$B" ] && { echo "找不到 $APP 的窗口"; exit 1; }
IFS=, read X Y W H <<< "$B"
echo "recording $APP window at $X,$Y ${W}x${H} for ${SECS}s -> $OUT"
screencapture -v $CLK -V "$SECS" -R "$X,$Y,$W,$H" -x "$OUT"
ffmpeg -v error -y -i "$OUT" -vf "fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p" -c:v libx264 -crf 16 "${OUT%.*}.mp4" && echo "-> ${OUT%.*}.mp4"
