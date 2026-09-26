#!/bin/zsh
# usage: sheet.sh <frames_dir> <out_prefix> [cols] [rows] [w]
D="$1"; O="$2"; C="${3:-2}"; R="${4:-4}"; WD="${5:-640}"; HT=$((WD*9/16))
N=$(ls "$D"/f_*.png | wc -l | tr -d ' '); PER=$((C*R)); i=0; k=0
while [ $i -lt $N ]; do
  ffmpeg -v error -y -pattern_type glob -i "$D/f_*.png" -vf "select='gte(n\,$i)',scale=$WD:$HT,tile=${C}x${R}:padding=4" -frames:v 1 "${O}_$k.png"
  i=$((i+PER)); k=$((k+1))
done
ls "${O}"_*.png
