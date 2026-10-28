import { loadFont } from "@remotion/fonts";
import { Video } from "@remotion/media";
import React from "react";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import rail from "./data/rail.json";
import {
  OUT_H,
  OUT_W,
  Pt,
  RHO,
  SCALE,
  leverGeometry,
  offsetAt,
  plane,
  thetaAt,
} from "./geometry";

const inter = "Inter";
loadFont({ family: inter, url: staticFile("fonts/Inter-Variable.woff2"), weight: "100 900" });

const WHITE = "#FFFFFF";
const YELLOW = "#FFD60A"; // movement paths
const MAGENTA = "#FF2BD6"; // moment arm
const CYAN = "#22E6FF"; // highlights

// ---- clips (swap these files for higher-res sources with the same framing) --
const LEVER_CLIP = "tbar.mp4"; // copy_199DDD96... conventional pivoting lever
const RAIL_CLIP = "rail.mp4"; // copy_932AC2E1... plate carriage on a straight rail

// ---- timeline (60 fps, source frames == composition frames) ---------------
const LEVER = { start: 100, end: 614 }; // 3 lifts, starts mid-lowering
const RAIL_SEG = { start: 250, end: 900 }; // 3 lifts
const CMP = { frames: 330, leverStart: 349, railStart: 291 };
const S1 = LEVER.end - LEVER.start;
const S2 = RAIL_SEG.end - RAIL_SEG.start;
export const COMPARE_FRAMES = S1 + S2 + CMP.frames;
const XF = 15; // crossfade

const ease = Easing.bezier(0.16, 1, 0.3, 1);
const ramp = (f: number, a: number, b: number) =>
  interpolate(f, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
const fmt = (p: Pt) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;

// lever: range of angles shown anywhere in the video
const leverThetas: number[] = [];
for (let i = LEVER.start; i <= CMP.leverStart + CMP.frames; i++) leverThetas.push(thetaAt(i));
const TH_MIN = Math.min(...leverThetas);
const TH_MAX = Math.max(...leverThetas);
/** lever resistance relative to its heaviest point in the clip (moment arm ratio) */
const leverRel = (th: number) => Math.cos(th) / Math.cos(TH_MIN);

// rail: straight-line geometry measured by analysis/track_rail.py
const RS = SCALE; // same 480 -> 1080 scale
const D: Pt = rail.railDir as Pt; // unit vector up the rail (image)
const DOWN: Pt = [-0.047, 0.999]; // true vertical in this shot (camera roll ~2.7 deg)
const railPlate = (src: number): Pt => {
  const p = rail.plate[Math.min(rail.plate.length - 1, Math.max(0, Math.round(src)))];
  return [p[0] * RS, p[1] * RS];
};
const RAIL_STOP: Pt = [318 * RS, 656 * RS]; // bottom spring stop of the fixed rail
const RAIL_TOP: Pt = [RAIL_STOP[0] + D[0] * 300 * RS, RAIL_STOP[1] + D[1] * 300 * RS];
const C0 = rail.railCentre as Pt;
const PATH_A: Pt = [(C0[0] + D[0] * rail.alongMin) * RS, (C0[1] + D[1] * rail.alongMin) * RS];
const PATH_B: Pt = [(C0[0] + D[0] * rail.alongMax) * RS, (C0[1] + D[1] * rail.alongMax) * RS];
const GRAV = 230; // gravity arrow length (output px), same on both machines
const ALONG = GRAV * (DOWN[0] * -D[0] + DOWN[1] * -D[1]); // share of gravity along the rail

// ---------------------------------------------------------------------------
export const Compare: React.FC = () => {
  const f = useCurrentFrame();
  const fadeIn = (start: number) => ramp(f, start, start + XF);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Sequence durationInFrames={S1 + XF} name="Machine 1 - lever">
        <AbsoluteFill style={{ opacity: 1 - ramp(f, S1 - XF, S1) }}>
          <LeverScene startSrc={LEVER.start} reveal={LEVER_REVEAL} />
          <Tag text="MACHINE 1 · LEVER" />
        </AbsoluteFill>
      </Sequence>
      <Sequence from={S1 - XF} durationInFrames={S2 + XF} name="Machine 2 - rail">
        <AbsoluteFill style={{ opacity: fadeIn(S1 - XF) * (1 - ramp(f, S1 + S2 - XF, S1 + S2)) }}>
          <RailScene startSrc={RAIL_SEG.start - XF} reveal={RAIL_REVEAL} />
          <Tag text="MACHINE 2 · RAIL" />
        </AbsoluteFill>
      </Sequence>
      <Sequence from={S1 + S2 - XF} name="Comparison">
        <AbsoluteFill style={{ opacity: fadeIn(S1 + S2 - XF) }}>
          <Comparison />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
type Reveal = Record<string, number>;
const LEVER_REVEAL: Reveal = { dim: 30, points: 45, lever: 75, path: 105, gravity: 170, arm: 225, words: 300, ghost: 300 };
const RAIL_REVEAL: Reveal = { dim: 30 + XF, points: 40 + XF, rail: 70 + XF, path: 100 + XF, gravity: 160 + XF, along: 215 + XF, words: 290 + XF };
const ALL_ON: Reveal = { dim: -999, points: -999, lever: -999, rail: -999, path: -999, gravity: -999, arm: -999, along: -999, ghost: -999, words: 9999, labels: 9999 };

const Footage: React.FC<{ clip: string; startSrc: number; dim: number }> = ({ clip, startSrc, dim }) => (
  <AbsoluteFill style={{ filter: `brightness(${1 - 0.25 * dim}) saturate(${1 - 0.3 * dim})` }}>
    <Video src={staticFile(clip)} trimBefore={startSrc} muted objectFit="fill" style={{ width: OUT_W, height: OUT_H }} />
  </AbsoluteFill>
);

// ---------------------------------------------------------------------------
const LeverScene: React.FC<{ startSrc: number; reveal: Reveal }> = ({ startSrc, reveal }) => {
  const f = useCurrentFrame();
  const r = (k: string, len = 24) => ramp(f, reveal[k], reveal[k] + len);
  const lab = reveal.labels === undefined ? 1 : 0;
  const src = startSrc + f;
  const th = thetaAt(src);
  const g = leverGeometry(th, offsetAt(src));
  const rel = leverRel(th);

  // bar path, thicker where the machine pushes back harder
  const off = offsetAt(startSrc);
  const arc: { p: Pt; w: number }[] = [];
  for (let k = 0; k <= 40; k++) {
    const t = TH_MIN + (k / 40) * (TH_MAX - TH_MIN);
    arc.push({ p: plane(RHO * Math.cos(t), RHO * Math.sin(t), off), w: interpolate(leverRel(t), [0.8, 1], [2.5, 9], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) });
  }
  const pathDraw = r("path", 50);
  const shown = Math.round(pathDraw * 40);
  const armWidth = interpolate(rel, [0.8, 1], [3.5, 8], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ghostEnd = plane(RHO * Math.cos(TH_MIN), RHO * g.s, offsetAt(src));

  return (
    <AbsoluteFill>
      <Footage clip={LEVER_CLIP} startSrc={startSrc} dim={r("dim", 40)} />
      <svg width={OUT_W} height={OUT_H} style={{ position: "absolute", inset: 0 }}>
        <Defs />
        <g filter="url(#shadow)">
          {/* curved path of the plates */}
          <g opacity={0.95}>
            {arc.slice(1, shown + 1).map((a, k) => (
              <line key={k} x1={arc[k].p[0]} y1={arc[k].p[1]} x2={a.p[0]} y2={a.p[1]} stroke={YELLOW} strokeWidth={a.w} strokeLinecap="round" />
            ))}
          </g>
          {/* vertical through the pivot (where the moment arm is measured from) */}
          <path d={`M${fmt(g.pivot)} L${fmt(plane(0, RHO * g.s + 0.05))}`} stroke={WHITE} strokeWidth={2} strokeDasharray="5 8" opacity={0.7 * r("arm")} fill="none" />
          {/* lever */}
          <path d={`M${fmt(g.pivot)} L${fmt(g.plate)}`} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - r("lever", 30)} stroke={WHITE} strokeWidth={2.5} fill="none" />
          {/* longest moment arm in the clip (ghost) and the live moment arm */}
          <path d={`M${fmt(g.plate)} L${fmt(ghostEnd)}`} stroke={MAGENTA} strokeWidth={3} strokeDasharray="6 9" opacity={0.6 * r("ghost")} fill="none" />
          <path d={`M${fmt(g.armFoot)} L${fmt(g.plate)}`} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - r("arm", 30)} stroke={MAGENTA} strokeWidth={armWidth} strokeLinecap="round" fill="none" />
          {/* gravity */}
          <Arrow from={g.plate} to={[g.plate[0], g.plate[1] + GRAV]} grow={r("gravity", 24)} />
          {/* tracked points */}
          <Dot p={g.pivot} show={r("points", 18)} ring />
          <Dot p={g.plate} show={r("points", 18)} />
        </g>
      </svg>
      <Label p={[g.pivot[0] - 26, g.pivot[1] + 40]} align="right" show={lab * r("points") * (1 - r("words"))}>PIVOT</Label>
      <Label p={[(g.armFoot[0] + g.plate[0]) / 2, (g.armFoot[1] + g.plate[1]) / 2 - 36]} align="center" color={MAGENTA} show={lab * r("arm")}>
        MOMENT ARM
      </Label>
      <Label p={[arc[0].p[0] + 28, arc[0].p[1] - 70]} align="left" color={YELLOW} show={lab * r("words")}>HEAVIER</Label>
      <Label p={[arc[40].p[0] + 30, arc[40].p[1] - 20]} align="left" color={YELLOW} show={lab * r("words")}>LIGHTER</Label>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
const RailScene: React.FC<{ startSrc: number; reveal: Reveal }> = ({ startSrc, reveal }) => {
  const f = useCurrentFrame();
  const r = (k: string, len = 24) => ramp(f, reveal[k], reveal[k] + len);
  const lab = reveal.labels === undefined ? 1 : 0;
  const p = railPlate(startSrc + f);
  const gravTip: Pt = [p[0] + DOWN[0] * GRAV, p[1] + DOWN[1] * GRAV];
  const alongTip: Pt = [p[0] - D[0] * ALONG, p[1] - D[1] * ALONG];
  const railDraw = r("rail", 30);
  const pathDraw = r("path", 40);

  return (
    <AbsoluteFill>
      <Footage clip={RAIL_CLIP} startSrc={startSrc} dim={r("dim", 40)} />
      <svg width={OUT_W} height={OUT_H} style={{ position: "absolute", inset: 0 }}>
        <Defs />
        <g filter="url(#shadow)">
          {/* the fixed rail */}
          <path d={`M${fmt(RAIL_STOP)} L${fmt(RAIL_TOP)}`} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - railDraw} stroke={WHITE} strokeWidth={4} strokeLinecap="round" fill="none" />
          <circle cx={RAIL_STOP[0]} cy={RAIL_STOP[1]} r={7} fill={WHITE} opacity={railDraw} />
          {/* straight path of the plates: same thickness everywhere = same resistance everywhere */}
          <path d={`M${fmt(PATH_A)} L${fmt(PATH_B)}`} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - pathDraw} stroke={YELLOW} strokeWidth={6} strokeLinecap="round" fill="none" />
          {/* gravity, and the part of it the rail does not hold */}
          <Arrow from={p} to={gravTip} grow={r("gravity", 24)} />
          <Arrow from={p} to={alongTip} grow={r("along", 24)} color={CYAN} width={6} />
          <Dot p={p} show={r("points", 18)} />
        </g>
      </svg>
      <Label p={[RAIL_TOP[0] - 20, RAIL_TOP[1] + 10]} align="right" show={lab * r("rail") * (1 - r("words"))}>RAIL</Label>
      <Label p={[1030, PATH_B[1] - 40]} align="right" color={YELLOW} show={lab * r("words")}>
        SAME
      </Label>
      <Label p={[1030, PATH_B[1]]} align="right" color={YELLOW} show={lab * r("words")}>
        ALL THE WAY
      </Label>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
const PANEL_W = 505;
const PANEL_H = (PANEL_W * OUT_H) / OUT_W;
const Comparison: React.FC = () => {
  const f = useCurrentFrame();
  const leverRelNow = leverRel(thetaAt(CMP.leverStart + f));
  return (
    <AbsoluteFill>
      {[
        { name: "LEVER", rel: leverRelNow, scene: <LeverScene startSrc={CMP.leverStart} reveal={ALL_ON} />, x: 30 },
        { name: "RAIL", rel: 1, scene: <RailScene startSrc={CMP.railStart} reveal={ALL_ON} />, x: OUT_W - 30 - PANEL_W },
      ].map((m) => (
        <div key={m.name} style={{ position: "absolute", left: m.x, top: 230, width: PANEL_W }}>
          <div style={{ fontFamily: inter, fontWeight: 800, fontSize: 40, letterSpacing: "0.16em", color: WHITE, marginBottom: 18 }}>{m.name}</div>
          <div style={{ width: PANEL_W, height: PANEL_H, overflow: "hidden", borderRadius: 18, position: "relative" }}>
            <div style={{ width: OUT_W, height: OUT_H, scale: String(PANEL_W / OUT_W), transformOrigin: "0 0", position: "absolute" }}>{m.scene}</div>
          </div>
          {/* resistance bar, relative to each machine's own heaviest point */}
          <div style={{ marginTop: 26, fontFamily: inter, fontWeight: 700, fontSize: 24, letterSpacing: "0.18em", color: "rgba(255,255,255,0.7)" }}>MACHINE RESISTANCE</div>
          <div style={{ marginTop: 10, height: 16, width: PANEL_W, borderRadius: 8, background: "rgba(255,255,255,0.15)" }}>
            <div style={{ height: 16, width: PANEL_W * Math.min(1, m.rel), borderRadius: 8, background: CYAN }} />
          </div>
        </div>
      ))}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
const Defs: React.FC = () => (
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#000" floodOpacity="0.65" />
    </filter>
  </defs>
);

const Dot: React.FC<{ p: Pt; show: number; ring?: boolean }> = ({ p, show, ring }) => (
  <g opacity={show}>
    <circle cx={p[0]} cy={p[1]} r={ring ? 16 : 14} fill="none" stroke={WHITE} strokeWidth={2.5} />
    <circle cx={p[0]} cy={p[1]} r={5} fill={WHITE} />
  </g>
);

const Arrow: React.FC<{ from: Pt; to: Pt; grow: number; color?: string; width?: number }> = ({ from, to, grow, color = WHITE, width = 4 }) => {
  if (grow <= 0) return null;
  const tip: Pt = [from[0] + (to[0] - from[0]) * grow, from[1] + (to[1] - from[1]) * grow];
  const a = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const head = (da: number) => `${(tip[0] - Math.cos(a + da) * 22).toFixed(1)} ${(tip[1] - Math.sin(a + da) * 22).toFixed(1)}`;
  const base: Pt = [tip[0] - Math.cos(a) * 16, tip[1] - Math.sin(a) * 16];
  return (
    <g>
      <path d={`M${fmt(from)} L${fmt(base)}`} stroke={color} strokeWidth={width} fill="none" />
      <path d={`M${fmt(tip)} L${head(0.42)} L${head(-0.42)} Z`} fill={color} />
    </g>
  );
};

const Label: React.FC<{ p: Pt; align: "left" | "right" | "center"; show: number; color?: string; children: React.ReactNode }> = ({ p, align, show, color = WHITE, children }) =>
  show <= 0 ? null : (
    <div
      style={{
        position: "absolute",
        left: p[0],
        top: p[1],
        translate: align === "right" ? "-100% -50%" : align === "center" ? "-50% -50%" : "0 -50%",
        fontFamily: inter,
        fontWeight: 700,
        fontSize: 30,
        letterSpacing: "0.14em",
        color,
        opacity: show,
        whiteSpace: "nowrap",
        textShadow: "0 2px 10px rgba(0,0,0,0.9)",
      }}
    >
      {children}
    </div>
  );

const Tag: React.FC<{ text: string }> = ({ text }) => {
  const f = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: 70,
        top: 130,
        fontFamily: inter,
        fontWeight: 800,
        fontSize: 38,
        letterSpacing: "0.16em",
        color: WHITE,
        opacity: ramp(f, 10, 30),
        textShadow: "0 2px 14px rgba(0,0,0,0.8)",
      }}
    >
      {text}
    </div>
  );
};
