#!/bin/zsh
# 用法: new_project.sh <project_dir> <16x9|9x16|9x16-fusion>
# 建立 HyperFrames 项目：复制组件库、字体与对应画幅 demo 作为起点 index.html；按实际存在的字体文件生成 fonts.css
set -e
K="${0:A:h}/../components"; P="$1"; L="${2:-16x9}"
mkdir -p "$P/fonts" "$P/assets"
cp "$K/kit.css" "$K/kit.js" "$K/fx.js" "$K/media.js" "$K/kx.js" "$K/fusion-lib.js" "$K/grain.png" "$P/"
mkdir -p "$P/icons" && cp "$K/icons/icons.js" "$P/icons/"
setopt null_glob
for f in "$K"/fonts/*.(ttf|otf|woff2); do cp "$f" "$P/fonts/"; done
: > "$P/fonts.css"
for pair in "Black:MU Display Local:900" "Regular:MU UI Local:400" "Medium:MU UI Local:500" "Bold:MU UI Local:700"; do
  w=${pair%%:*}; rest=${pair#*:}; fam=${rest%:*}; wt=${rest##*:}
  for f in "$P"/fonts/*-$w.(ttf|otf|woff2); do echo "@font-face { font-family: \"$fam\"; font-weight: $wt; src: url(\"fonts/${f:t}\"); }" >> "$P/fonts.css"; break; done
done
if [ ! -s "$P/fonts.css" ]; then echo "提示: 未找到字体文件，回退到系统 Noto Sans CJK Bold（巨字字重不足，报告中需说明）"; fi
[ -f "$P/index.html" ] || { cp "$K/demo-$L/index.html" "$P/index.html"; [ -f "$K/demo-$L/common.js" ] && cp "$K/demo-$L/common.js" "$P/"; }
echo "project ready: $P  (layout=$L)"
