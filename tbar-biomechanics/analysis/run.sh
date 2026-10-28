#!/usr/bin/env bash
# Re-run tracking + camera solve after editing calibration.json.
# Needs: pip install opencv-python-headless scipy numpy
set -euo pipefail
cd "$(dirname "$0")"
python3 track_hub.py
python3 solve_camera.py
