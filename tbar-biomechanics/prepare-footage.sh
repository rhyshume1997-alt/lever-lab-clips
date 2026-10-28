#!/usr/bin/env bash
# Builds the 1080x1920 working copy of the T-bar row clip for Remotion.
# The original .mov is only read, never modified.
#  - every source frame kept 1:1 at 60 fps (no frame drops/dupes -> tracking stays in sync)
#  - Lanczos upscale 480x854 -> 1080x1920 with a light unsharp
#  - near-lossless H.264 (CRF 8) so Remotion receives the full source detail
set -euo pipefail
cd "$(dirname "$0")"
SRC=../copy_199DDD96-F5D5-4C64-AB68-BE05A66AF8EB.mov
mkdir -p public
ffmpeg -y -v error -i "$SRC" -an -fps_mode passthrough \
  -vf "scale=1080:1920:flags=lanczos+accurate_rnd+full_chroma_int,unsharp=5:5:0.35:5:5:0" \
  -c:v libx264 -preset slow -crf 8 -profile:v high -pix_fmt yuv420p \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -movflags +faststart public/tbar.mp4
ffprobe -v error -count_frames -select_streams v -show_entries stream=width,height,r_frame_rate,nb_read_frames -of csv=p=0 public/tbar.mp4
