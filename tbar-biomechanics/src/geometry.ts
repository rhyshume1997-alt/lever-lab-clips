import data from "./data/tracking.json";

// Everything here is driven by analysis/solve_camera.py output.
// Lever-plane coordinates (a, b) are in units of the pivot -> outer-plate-face
// distance L: a = horizontal (towards the plates), b = vertical (up).

export const OUT_W = 1080;
export const OUT_H = 1920;
export const SCALE = OUT_W / data.sourceWidth; // source px -> output px

export const SOURCE_FRAMES = data.theta.length;
export const REP_BOTTOMS = data.bottoms;
export const REP_TOPS = data.tops;
export const RHO = data.plateStackFraction; // plate-stack centre along the lever

type V3 = [number, number, number];
export type Pt = [number, number];

const { f, cx, cy, pitch, yaw, pivotDepth } = data.camera;
const U: V3 = [0, -Math.cos(pitch), Math.sin(pitch)];
const Fw: V3 = [0, Math.sin(pitch), Math.cos(pitch)];
const H: V3 = [-Math.cos(yaw), -Math.sin(yaw) * Fw[1], -Math.sin(yaw) * Fw[2]];
const P0: V3 = [
  (pivotDepth * (data.pivot[0] - cx)) / f,
  (pivotDepth * (data.pivot[1] - cy)) / f,
  pivotDepth,
];

const clampFrame = (i: number) =>
  Math.min(SOURCE_FRAMES - 1, Math.max(0, Math.round(i)));

/** Project a lever-plane point to output pixels. */
export const plane = (a: number, b: number, offset: Pt = [0, 0]): Pt => {
  const P: V3 = [
    P0[0] + a * H[0] + b * U[0],
    P0[1] + a * H[1] + b * U[1],
    P0[2] + a * H[2] + b * U[2],
  ];
  return [
    ((f * P[0]) / P[2] + cx + offset[0]) * SCALE,
    ((f * P[1]) / P[2] + cy + offset[1]) * SCALE,
  ];
};

export const thetaAt = (srcFrame: number) => data.theta[clampFrame(srcFrame)];

/** Tracking residual (source px) that keeps model points glued to the real plate. */
export const offsetAt = (srcFrame: number): Pt =>
  data.offset[clampFrame(srcFrame)] as Pt;

/** External resistance torque about the pivot, relative to lever horizontal (= 1). */
export const relTorque = (theta: number) => Math.cos(theta);

export const deg = (rad: number) => (rad * 180) / Math.PI;

/** Interpolated theta + offset for a fractional source frame (used by the hook sweep). */
export const stateAt = (srcFrame: number) => {
  const i0 = Math.floor(srcFrame);
  const t = srcFrame - i0;
  const o0 = offsetAt(i0);
  const o1 = offsetAt(i0 + 1);
  return {
    theta: thetaAt(i0) * (1 - t) + thetaAt(i0 + 1) * t,
    offset: [o0[0] * (1 - t) + o1[0] * t, o0[1] * (1 - t) + o1[1] * t] as Pt,
  };
};

/** All screen-space geometry for one lever state. */
export const leverGeometry = (theta: number, offset: Pt) => {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const pivot = plane(0, 0);
  const plate = plane(RHO * c, RHO * s, offset);
  // foot of the moment arm: on the vertical through the pivot, level with the plates
  const armFoot = plane(0, RHO * s);
  const gravityTip = plane(RHO * c, RHO * s - 0.17, offset);
  return { pivot, plate, armFoot, gravityTip, c, s };
};

export const polyline = (pts: Pt[]) =>
  pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" ");
