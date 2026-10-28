"""Fit the plate-face rim ellipse at one frame (RANSAC) and save a check image.

usage: python3 fit_ellipse.py FRAME HUB_X HUB_Y [bright|canny] [RMIN RMAX]
  bright: white plate lip (best near the top of the rep)
  canny : edge pixels (best near the bottom, where the lip is unlit)
Prints [frame, minor/major ratio, minor-axis angle] for calibration.json and
writes out/ellipse_<frame>.png - check that the green ellipse follows the rim.
"""
import json
import os
import sys

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
cal = json.load(open(os.path.join(HERE, "calibration.json")))
frame, hx, hy = int(sys.argv[1]), float(sys.argv[2]), float(sys.argv[3])
mode = sys.argv[4] if len(sys.argv) > 4 else "bright"
rmin, rmax = (float(sys.argv[5]), float(sys.argv[6])) if len(sys.argv) > 6 else (50, 90)

cap = cv2.VideoCapture(os.path.join(HERE, cal["source"]))
cap.set(cv2.CAP_PROP_POS_FRAMES, frame)
_, img = cap.read()
g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
if mode == "bright":
    roi = g[int(hy - 120) : int(hy + 120), max(0, int(hx - 120)) : int(hx + 120)]
    mask = g > np.percentile(roi, 90)
else:
    mask = cv2.Canny(cv2.GaussianBlur(g, (3, 3), 0), 40, 110) > 0
ys, xs = np.nonzero(mask)
pts = np.stack([xs, ys], 1).astype(float)
r = np.hypot(pts[:, 0] - hx, pts[:, 1] - hy)
pts = pts[(r > rmin) & (r < rmax)]


def edist(p, e):
    (ex, ey), (w, h), ang = e
    t = np.deg2rad(ang)
    d = p - [ex, ey]
    x = d[:, 0] * np.cos(t) + d[:, 1] * np.sin(t)
    y = -d[:, 0] * np.sin(t) + d[:, 1] * np.cos(t)
    return np.abs(np.sqrt((x / (w / 2)) ** 2 + (y / (h / 2)) ** 2) - 1) * np.sqrt(w * h / 4)


rng = np.random.default_rng(1)
best = None
for _ in range(6000):
    try:
        e = cv2.fitEllipse(pts[rng.choice(len(pts), 6, replace=False)].astype(np.float32))
    except cv2.error:
        continue
    (ex, ey), (w, h), _ = e
    if np.hypot(ex - hx, ey - hy) > 15 or min(w, h) < 1.4 * rmin or max(w, h) > 2.2 * rmax:
        continue
    inl = edist(pts, e) < 1.2
    if best is None or inl.sum() > best[0]:
        best = (inl.sum(), inl)
e = cv2.fitEllipse(pts[best[1]].astype(np.float32))
(w, h), ang = e[1], e[2]
minor_ang = ang if w < h else ang + 90
print([frame, round(min(w, h) / max(w, h), 3), round(minor_ang % 180, 1)])

vis = np.clip(((img / 255.0) ** 0.6) * 255, 0, 255).astype(np.uint8)
cv2.ellipse(vis, e, (0, 255, 0), 1)
os.makedirs(os.path.join(HERE, "out"), exist_ok=True)
cv2.imwrite(os.path.join(HERE, "out", f"ellipse_{frame}.png"), vis)
