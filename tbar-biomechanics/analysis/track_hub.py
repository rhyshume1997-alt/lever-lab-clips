"""Track the plate-face hub through every frame of the T-bar row clip.

Stage 1: short-range template tracking seeded from the hand-verified anchor,
         used only over the first two reps (where it was visually verified).
Stage 2: every frame is matched against a fixed bank of hub templates taken
         from stage 1. Nothing is updated frame-to-frame, so there is no drift.

Output: analysis/out/hub_track.json  ->  [[x, y, score], ...] per source frame.
"""
import json
import os
import sys

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
cal = json.load(open(os.path.join(HERE, "calibration.json")))
OUT = os.path.join(HERE, "out")
os.makedirs(OUT, exist_ok=True)

cap = cv2.VideoCapture(os.path.join(HERE, cal["source"]))
frames = []
while True:
    ok, f = cap.read()
    if not ok:
        break
    g = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
    frames.append(cv2.GaussianBlur(g, (3, 3), 0).astype(np.float32))
N = len(frames)
print("frames", N)

# hub sits near the left edge at the bottom of each rep: pad so templates fit
PAD = 40
G = np.pad(np.array(frames), ((0, 0), (0, 0), (PAD, 0)), mode="edge")


def patch(g, x, y, r):
    xi, yi = int(round(x)), int(round(y))
    return g[yi - r : yi + r + 1, xi - r : xi + r + 1].copy()


def match(g, tpl, x, y, r, search):
    xi, yi = int(round(x)), int(round(y))
    x0, y0 = xi - r - search, yi - r - search
    win = g[y0 : yi + r + search + 1, x0 : xi + r + search + 1]
    res = cv2.matchTemplate(win, tpl, cv2.TM_CCOEFF_NORMED)
    _, mv, _, (px, py) = cv2.minMaxLoc(res)
    dx = dy = 0.0  # sub-pixel parabola refinement
    if 0 < px < res.shape[1] - 1:
        a, b, c = res[py, px - 1], res[py, px], res[py, px + 1]
        dx = 0.5 * (a - c) / (a - 2 * b + c + 1e-9)
    if 0 < py < res.shape[0] - 1:
        a, b, c = res[py - 1, px], res[py, px], res[py + 1, px]
        dy = 0.5 * (a - c) / (a - 2 * b + c + 1e-9)
    return x0 + px + dx + r, y0 + py + dy + r, float(mv)


# ---- stage 1: seed tracking over the verified range -----------------------
seed_f, (sx, sy) = next(iter((int(k), v) for k, v in cal["hubAnchors"].items()))
b0, b1, bstep = cal["templateBankFrames"]
R1, S1 = 18, 28
seed = {seed_f: (sx + PAD, sy)}
for step in (1, -1):
    x, y = sx + PAD, sy
    tpl = patch(G[seed_f], x, y, R1)
    f = seed_f + step
    while b0 <= f <= b1:
        x, y, _ = match(G[f], tpl, x, y, R1, S1)
        seed[f] = (x, y)
        tpl = 0.7 * tpl + 0.3 * patch(G[f], x, y, R1)
        f += step

# ---- stage 2: drift-free matching against the fixed bank ------------------
R2, S2 = 15, 22
bank = [(patch(G[f], *seed[f], R2), seed[f][1]) for f in range(b0, b1 + 1, bstep)]
track = []
x, y = seed[b0]
for f in range(N):
    cands = []
    for tpl, by in bank:
        if abs(by - y) > 60:  # only templates from a similar lever height
            continue
        cx, cy, v = match(G[f], tpl, x, y, R2, S2)
        cands.append((v, cx, cy))
    cands.sort(reverse=True)
    top = cands[:3]
    w = np.array([c[0] for c in top])
    w = np.maximum(w - w.min() + 1e-3, 1e-3)
    x = float(np.average([c[1] for c in top], weights=w))
    y = float(np.average([c[2] for c in top], weights=w))
    track.append([x - PAD, y, top[0][0]])

json.dump(track, open(os.path.join(OUT, "hub_track.json"), "w"))
s = np.array(track)[:, 2]
print("match score min %.3f median %.3f" % (s.min(), np.median(s)))
