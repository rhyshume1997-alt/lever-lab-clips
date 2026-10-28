#!/usr/bin/env bash
# Builds the 1080x1920 working copies used by Remotion. Originals are only read.
#  - every source frame kept 1:1 (no drops/dupes -> overlays stay in sync)
#  - Lanczos upscale with a light unsharp, near-lossless H.264 (CRF 8)
# To use higher-resolution originals: point LEVER_SRC / RAIL_SRC at them and re-run.
# Same framing and frame rate = no other changes needed (tracking is stored in
# 480x854-normalised source pixels and scaled to the output).
set -euo pipefail
cd "$(dirname "$0")"
LEVER_SRC=${LEVER_SRC:-../copy_199DDD96-F5D5-4C64-AB68-BE05A66AF8EB.mov}  # pivoting lever T-bar
RAIL_SRC=${RAIL_SRC:-../copy_932AC2E1-8BF7-48A5-A7BC-C7824A74D862.mov}    # plate carriage on a rail
mkdir -p public
prep() {
  ffmpeg -y -v error -i "$1" -an -fps_mode passthrough \
    -vf "scale=1080:1920:flags=lanczos+accurate_rnd+full_chroma_int,unsharp=5:5:0.35:5:5:0" \
    -c:v libx264 -preset slow -crf 8 -profile:v high -pix_fmt yuv420p \
    -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
    -movflags +faststart "$2"
  ffprobe -v error -count_frames -select_streams v -show_entries stream=width,height,r_frame_rate,nb_read_frames -of csv=p=0 "$2"
}
prep "$LEVER_SRC" public/tbar.mp4
prep "$RAIL_SRC" public/rail.mp4
