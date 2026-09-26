#!/usr/bin/env bash
# Encodes build/frames/*.png + build/soundtrack.wav into the deliverables:
#   build/Hyperliquid_Promo_1080p60.mp4        master   (H.264 High, CRF 18)
#   build/Hyperliquid_Promo_1080p60_share.mp4  share    (CRF 22, capped at 12 Mbps)
#   renders/preview_720p.mp4                   preview  (2-pass, ~24 MB)
#   renders/poster.jpg                         end-card still
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRAMES="$ROOT/build/frames"; WAV="$ROOT/build/soundtrack.wav"; OUT="$ROOT/build"
MASTER="$OUT/Hyperliquid_Promo_1080p60.mp4"

# Apple's AudioToolbox AAC keeps true peak under -1 dBTP; fall back to ffmpeg's encoder elsewhere.
AAC=aac_at
ffmpeg -hide_banner -encoders 2>/dev/null | grep -q aac_at || AAC=aac

# BT.709 conversion + light luma dither (removes banding in the dark gradients at ~no bitrate cost).
VF="scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,noise=c0s=2:c0f=t+u"
COMMON=(-map 0:v -map 1:a -vf "$VF" -c:v libx264 -preset slow
  -x264-params "aq-mode=3:aq-strength=0.9:deblock=-1,-1" -profile:v high -level 4.2 -pix_fmt yuv420p
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv
  -c:a "$AAC" -b:a 320k -ar 48000 -movflags +faststart -shortest)

echo "master…"
ffmpeg -v error -y -framerate 60 -i "$FRAMES/f_%05d.png" -i "$WAV" "${COMMON[@]}" -crf 18 "$MASTER"
echo "share…"
ffmpeg -v error -y -framerate 60 -i "$FRAMES/f_%05d.png" -i "$WAV" "${COMMON[@]}" -crf 22 -maxrate 12M -bufsize 24M "$OUT/Hyperliquid_Promo_1080p60_share.mp4"
echo "preview…"
ffmpeg -v error -y -i "$MASTER" -vf scale=1280:720:flags=lanczos -c:v libx264 -preset slow -b:v 3000k -pass 1 -passlogfile "$OUT/x264pass" -an -f mp4 /dev/null
ffmpeg -v error -y -i "$MASTER" -vf scale=1280:720:flags=lanczos -c:v libx264 -preset slow -b:v 3000k -pass 2 -passlogfile "$OUT/x264pass" \
  -c:a "$AAC" -b:a 160k -movflags +faststart "$ROOT/renders/preview_720p.mp4"
rm -f "$OUT"/x264pass*
ffmpeg -v error -y -ss 59.6 -i "$MASTER" -frames:v 1 -q:v 2 "$ROOT/renders/poster.jpg"
ls -lh "$MASTER" "$OUT/Hyperliquid_Promo_1080p60_share.mp4" "$ROOT/renders/preview_720p.mp4" "$ROOT/renders/poster.jpg"
