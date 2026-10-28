# Lever vs rail T-bar row comparison (current deliverable)

**Video: [`output/tbar-row-lever-vs-rail_1080x1920_60fps.mp4`](output/)** (Remotion composition `TbarCompare`, code in `src/Compare.tsx`).
It's about 25 s, with no audio and no captions, ready for voiceover and captions in CapCut.

| Section | Clip | What the overlays show |
| --- | --- | --- |
| 1. Lever (about 8.6 s) | `copy_199DDD96...mov` | Pivot, plates, curved path (thicker where the machine pushes back harder), gravity, live moment arm, dashed ghost of the longest arm |
| 2. Rail (about 10.8 s) | `copy_932AC2E1...mov` | Fixed straight rail, plates, straight path (even thickness), gravity, cyan arrow = the share of gravity along the rail |
| 3. Side by side (about 5.5 s) | both | Each machine with a resistance bar, relative to its own heaviest point |

**Mechanisms (measured, not assumed)**
- **Lever:** the plates rotate about a fixed pivot (bearing beside the footplate). The lever angle comes from a camera model fitted to the tracking (see below): about 12-16 degrees at the bottom and 32-38 degrees at the top. The gravitational moment is about `m*g*L*cos(theta)`, so the moment arm, and with it the force needed at the handles along their arc, is about 15-18% smaller at the top than at the bottom.
- **Rail:** the handles, carriage and plates form one rigid frame sliding along a fixed rail. Over 127 px of travel, the tracked path deviates from a straight line by 0.2 px RMS. A straight, fixed incline means the gravity component along the rail is the same at every point, so the static resistance profile is flat.
- **What isn't claimed:** no absolute forces or torques (plate, carriage and lever masses are unknown), and no joint moments or muscle demands. The bars ignore friction, the bottom bumper springs, and inertia (the rail lifts are fast). The cyan arrow length uses the rail's image angle, so it's illustrative.

**Rebuild:** `./prepare-footage.sh`, then `python3 analysis/track_rail.py` (rail tracking), then
`npx remotion render TbarCompare output/tbar-row-lever-vs-rail_1080x1920_60fps.mp4 --codec=h264 --crf=16 --x264-preset=slow --image-format=png --muted`.

---

# T-bar row biomechanics (Lever Lab trial)

A 15-second, 1080x1920, 60 fps reel built in Remotion on top of the real plate-loaded
T-bar row clip (`../copy_199DDD96-F5D5-4C64-AB68-BE05A66AF8EB.mov`). The original
footage is only read, never modified.

**Finished renders: [`renders/`](renders/)**

| File | What it is |
| --- | --- |
| `tbar-row-biomechanics_1080x1920_60fps.mp4` | Finished reel (H.264, CRF 12, BT.709, no audio) |
| `tbar-row-graphics_alpha_prores4444.mov` | Graphics only, real transparency (ProRes 4444) for desktop editors |
| `tbar-row-graphics_on-black_1080x1920_60fps.mp4` | Graphics only on pure black, for CapCut's **Screen** blend |

## What the overlays show

| Element | Colour | Source |
| --- | --- | --- |
| Machine pivot (ring + pulse) | white | bearing housing of the lever beside the footplate, fixed at source pixel (364, 700) |
| Plate-stack centre tracking point | white | template-tracked plate hub, every frame |
| Lever (pivot to plates) | white | |
| Bar path (dotted arc, comet trail) | yellow | the tracked positions, not a generic curve |
| Gravity vector + line of action | white | vertical in the lever plane |
| Moment arm (right-angle triangle) | magenta | horizontal distance from the pivot's vertical to the gravity line |
| Lever angle arc, readouts, sparkline | cyan | |

Every line is drawn as real 3D geometry in the lever's plane of rotation, projected through
the calibrated camera. That's why the "horizontal" moment arm leans in the shot: it's a
true horizontal, seen in perspective.

The moment arm is drawn at the height of the plates, from the pivot's vertical line to the
gravity line. That's the same perpendicular distance as one drawn at pivot height, which
would sit below the bottom of the frame.

## The biomechanics and what is (and isn't) claimed

- The plates sit on a horn that runs along the lever, so the plate-stack centre lies on the
  lever axis. External torque about the pivot is `m*g*L*cos(theta)`, where theta is the lever
  angle above horizontal.
- **Machine torque** is shown as `cos(theta)`, so 100% means the lever is horizontal.
  No absolute torque is shown, because plate mass, lever mass and lever length aren't
  known. The ratio needs only the angle.
- In this clip the lever runs from about 12-16 degrees (bottom) to about 32-38 degrees
  (top). So the machine's resistance torque is about 14-18% *lower* at the top than at the
  bottom of the same rep.
- This is the machine's external torque. It is not the muscular demand on the back.
  Muscle force also depends on body position, joint moment arms and the length-tension
  relationship, and none of those are measured here. So the outro is a three-step ELI5
  with no muscle-force number: (1) the bar tilts up, so the plates move closer to the
  pivot and the machine gets ~14% lighter; (2) at the top the back muscles are fully
  squeezed, where they're weakest; (3) so the hard part is your back, not the load, and
  pausing there trains the upper back where it's weakest.

## How the angle is measured (why not just read it off the image)

The camera views the lever plane at roughly 49 degrees, and the plates swing towards the
lens at the bottom. Reading angles straight off the image gives 5-41 degrees, which is
wrong. The pipeline instead fits a pinhole-camera model:

1. `analysis/track_hub.py`: drift-free tracking of the plate hub. Every frame is matched
   against a fixed bank of verified templates, with sub-pixel refinement.
   Median NCC is 0.98.
2. `analysis/fit_ellipse.py`: plate-face rim ellipses. The plate face is perpendicular to
   the lever, so each ellipse's minor/major ratio and axis give the lever's 3D direction.
3. `analysis/solve_camera.py`: fits focal length, camera pitch, lever-plane yaw and pivot
   depth to all hub positions plus the ellipses plus the floor-tile horizon. It then solves
   theta for every frame and lightly smooths it (Savitzky-Golay, 9 frames). Hub
   reprojection RMS is about 2.4 source px.

Sensitivity: assuming any focal length from 616-780 px shifts theta by about ±3 degrees.
The top-vs-bottom torque difference barely moves, because both ends shift together.

## Manual calibration (what to adjust)

Everything lives in `analysis/calibration.json`, in **source pixels** (480x854):

- `pivot`: the most important value. If the white pivot ring isn't on the lever's
  bearing, move it here.
- `hubAnchors`: one verified hub position seeds the tracker. If the tracking point
  slides off the plate hub, correct it here.
- `plateEllipses`: re-measure with `python3 analysis/fit_ellipse.py <frame> <hubX> <hubY> bright|canny`
  and check `analysis/out/ellipse_<frame>.png`.
- `horizonY`: horizon row from the floor tiles.

Then run `./analysis/run.sh`. This regenerates `src/data/tracking.json`, and the video
picks it up automatically.

## Rebuilding

```bash
npm i
pip install opencv-python-headless scipy numpy
./prepare-footage.sh          # Lanczos 1080x1920 working copy, every source frame kept 1:1
./analysis/run.sh             # tracking + camera solve (optional; tracking.json is committed)
npx remotion studio           # preview
# finished reel
npx remotion render TbarRow renders/tbar-row-biomechanics_1080x1920_60fps.mp4 \
  --codec=h264 --crf=12 --x264-preset=slow --pixel-format=yuv420p --color-space=bt709 --image-format=png --muted
# graphics only, transparent
npx remotion render TbarRowGraphics renders/tbar-row-graphics_alpha_prores4444.mov
```

In this cloud sandbox Remotion couldn't download its own Chrome. The renders used
`--browser-executable=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`,
which isn't needed on a normal machine.

## Known limitations

- The source is 480x854. It was upscaled 2.25x with Lanczos plus a light unsharp. No AI
  upscaling was used, so the footage is softer than native 1080p, while the graphics are
  native-resolution vectors.
- The clip carries a CapCut/Dreamina re-encode tag, so there is no lens metadata. Focal
  length is estimated from the image.
- Camera roll is assumed to be 0. A vertical machine upright measures 0.7 degrees.
- Torque assumes the lever's own centre of mass lies on the lever axis. The handle frame
  could shift it slightly.
- The tracking point is the estimated plate-stack centre: 96% of the way from the pivot
  to the outer plate face.
- Single camera angle, single clip. Other machines or angles need a new pivot, anchors
  and ellipses.
