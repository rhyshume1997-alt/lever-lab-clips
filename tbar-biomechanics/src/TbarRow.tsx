import { loadFont } from "@remotion/fonts";
import { Video } from "@remotion/media";
import React from "react";
import {
  AbsoluteFill,
  Easing,
  Freeze,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import {
  OUT_H,
  OUT_W,
  Pt,
  REP_BOTTOMS,
  REP_TOPS,
  RHO,
  deg,
  leverGeometry,
  offsetAt,
  plane,
  polyline,
  relTorque,
  stateAt,
  thetaAt,
} from "./geometry";

// bundled variable fonts (Inter, JetBrains Mono - SIL OFL) so renders work offline
const inter = "Inter";
const mono = "JetBrains Mono";
loadFont({ family: inter, url: staticFile("fonts/Inter-Variable.woff2"), weight: "100 900" });
loadFont({ family: mono, url: staticFile("fonts/JetBrainsMono-Variable.woff2"), weight: "100 800" });

// ---- palette ---------------------------------------------------------------
const WHITE = "#FFFFFF";
const YELLOW = "#FFD60A"; // movement paths
const MAGENTA = "#FF2BD6"; // moment arms
const CYAN = "#22E6FF"; // numerical readouts

// ---- timeline (composition fps = source fps = 60) -------------------------
const START_SRC = REP_BOTTOMS[0]; // bottom of rep 1 (frozen for the hook)
const HOOK_TOP_SRC = REP_TOPS.find((t) => t > START_SRC)!; // top of rep 1
const END_SRC = REP_TOPS.filter((t) => t > START_SRC)[2]; // top of rep 3
const END_REP_BOTTOM = [...REP_BOTTOMS].reverse().find((b) => b < END_SRC)!;
export const HOOK = 120; // 2.0 s freeze
const PLAY = END_SRC - START_SRC;
const OUTRO = 150;
export const TOTAL_FRAMES = HOOK + PLAY + OUTRO;
const OUTRO_AT = HOOK + PLAY;

const srcFrameAt = (fr: number) =>
  fr < HOOK ? START_SRC : Math.min(END_SRC, START_SRC + (fr - HOOK));

const ease = Easing.bezier(0.16, 1, 0.3, 1);
const ramp = (fr: number, a: number, b: number) =>
  interpolate(fr, [a, b], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });

const fmt = (p: Pt) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`;

export type TbarRowProps = { graphicsOnly: boolean; blackBackground?: boolean };

// ---------------------------------------------------------------------------
export const TbarRow: React.FC<TbarRowProps> = ({ graphicsOnly, blackBackground }) => {
  const fr = useCurrentFrame();
  const src = srcFrameAt(fr);
  const theta = thetaAt(src);
  const off = offsetAt(src);
  const g = leverGeometry(theta, off);

  // hook sweep: ghost marker rides the real rep-1 path from bottom to top
  const sweep = ramp(fr, 18, 70);
  const sweepState = stateAt(START_SRC + sweep * (HOOK_TOP_SRC - START_SRC));
  const sweepPts: Pt[] = [];
  for (let k = 0; k <= 48; k++) {
    const s = stateAt(START_SRC + (k / 48) * sweep * (HOOK_TOP_SRC - START_SRC));
    sweepPts.push(plane(RHO * Math.cos(s.theta), RHO * Math.sin(s.theta), s.offset));
  }
  const ghost = plane(
    RHO * Math.cos(sweepState.theta),
    RHO * Math.sin(sweepState.theta),
    sweepState.offset,
  );

  // full bar-path arc across the played reps (faint guide)
  const playedThetas: number[] = [];
  for (let i = START_SRC; i <= END_SRC; i++) playedThetas.push(thetaAt(i));
  const thMin = Math.min(...playedThetas);
  const thMax = Math.max(...playedThetas);
  const arcPts: Pt[] = [];
  for (let k = 0; k <= 60; k++) {
    const t = thMin + (k / 60) * (thMax - thMin);
    arcPts.push(plane(RHO * Math.cos(t), RHO * Math.sin(t), offsetAt(START_SRC)));
  }

  // comet trail of the real plate centre (last 40 source frames)
  const trail: Pt[] = [];
  if (fr >= HOOK) {
    for (let i = Math.max(START_SRC, src - 40); i <= src; i++) {
      const th = thetaAt(i);
      trail.push(plane(RHO * Math.cos(th), RHO * Math.sin(th), offsetAt(i)));
    }
  }

  // angle arc in the lever plane
  const arcR = 0.3;
  const angPts: Pt[] = [];
  for (let k = 0; k <= 30; k++) {
    const t = (k / 30) * theta;
    angPts.push(plane(arcR * Math.cos(t), arcR * Math.sin(t)));
  }
  const angLabel = plane(0.37 * Math.cos(theta / 2), 0.37 * Math.sin(theta / 2));

  // reveal timings
  const pivotIn = ramp(fr, 2, 16);
  const leverIn = ramp(fr, 6, 26);
  const plateIn = ramp(fr, 12, 24);
  const pathIn = ramp(fr, 18, 70);
  const ghostOut = 1 - ramp(fr, 96, 118);
  const gravityIn = ramp(fr, HOOK + 4, HOOK + 28);
  const armIn = ramp(fr, HOOK + 16, HOOK + 44);
  const angleIn = ramp(fr, HOOK + 30, HOOK + 54);
  const readoutIn = ramp(fr, HOOK + 36, HOOK + 64) * (1 - ramp(fr, OUTRO_AT + 4, OUTRO_AT + 22));
  const questionOut = 1 - ramp(fr, HOOK + 20, HOOK + 44);
  const labelsOut = 1 - ramp(fr, HOOK + 330, HOOK + 360);
  const outroIn = ramp(fr, OUTRO_AT + 14, OUTRO_AT + 40);
  const ghostArmIn = ramp(fr, OUTRO_AT + 6, OUTRO_AT + 40);

  // pivot pulse ring
  const pulse = ((fr % 90) / 90) * 1;

  // live numbers
  const torque = relTorque(theta);
  const bottomTheta = thetaAt(END_REP_BOTTOM);
  const drop = 1 - relTorque(thetaAt(END_SRC)) / relTorque(bottomTheta);

  // sparkline of torque over the played frames
  const SPARK_W = 380;
  const SPARK_H = 84;
  const sparkPts: Pt[] = [];
  if (fr >= HOOK) {
    for (let i = START_SRC; i <= src; i += 2) {
      const x = ((i - START_SRC) / PLAY) * SPARK_W;
      const v = relTorque(thetaAt(i));
      sparkPts.push([x, SPARK_H - ((v - 0.75) / 0.25) * SPARK_H]);
    }
  }

  // ghost moment arm (bottom-of-rep length) shown at the outro
  const ghostArmEnd = plane(RHO * Math.cos(bottomTheta), RHO * g.s, off);

  const footageBrightness =
    fr < HOOK
      ? 0.62
      : interpolate(fr, [HOOK, HOOK + 24, OUTRO_AT, OUTRO_AT + 30], [0.62, 0.92, 0.92, 0.66], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
  const pushIn = interpolate(fr, [0, HOOK], [1.0, 1.035], {
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });
  const zoom = fr < HOOK ? pushIn : interpolate(fr, [HOOK, HOOK + 30], [1.035, 1], {
    extrapolateRight: "clamp",
    easing: ease,
  });
  // zoom about the pivot so geometry and footage stay locked together
  const origin = `${g.pivot[0]}px ${g.pivot[1]}px`;

  return (
    <AbsoluteFill style={{ backgroundColor: graphicsOnly && !blackBackground ? "transparent" : "#000" }}>
      <AbsoluteFill style={{ scale: String(zoom), transformOrigin: origin }}>
        {graphicsOnly ? null : (
          <AbsoluteFill
            style={{
              filter: `brightness(${footageBrightness}) contrast(1.1) saturate(0.62)`,
            }}
          >
            {/* one decoded video for hook freeze, playback and outro freeze (no colour pop) */}
            <Freeze frame={HOOK + (src - START_SRC)}>
              <Sequence from={HOOK} layout="absolute-fill" name="Footage">
                <Footage />
              </Sequence>
            </Freeze>
          </AbsoluteFill>
        )}

        {/* ---------------- geometry overlay ---------------- */}
        <svg width={OUT_W} height={OUT_H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="softglow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="10" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* bar path: faint full arc + hook sweep + live comet trail */}
          <g filter="url(#glow)">
            <path
              d={polyline(arcPts)}
              fill="none"
              stroke={YELLOW}
              strokeWidth={3}
              strokeDasharray="2 9"
              strokeLinecap="round"
              opacity={0.85 * ramp(fr, HOOK - 30, HOOK)}
            />
            <path
              d={polyline(sweepPts)}
              fill="none"
              stroke={YELLOW}
              strokeWidth={4}
              strokeLinecap="round"
              opacity={pathIn > 0 ? interpolate(fr, [HOOK - 10, HOOK + 20], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0}
            />
            {trail.slice(1).map((p, k) => {
              const a = (k + 1) / trail.length;
              return (
                <line
                  key={k}
                  x1={trail[k][0]}
                  y1={trail[k][1]}
                  x2={p[0]}
                  y2={p[1]}
                  stroke={YELLOW}
                  strokeWidth={1 + 4 * a}
                  strokeLinecap="round"
                  opacity={a}
                />
              );
            })}
          </g>

          {/* hook: ghost marker riding the real path, and the top-of-rep marker */}
          {fr < HOOK + 20 ? (
            <g filter="url(#glow)" opacity={ghostOut}>
              <circle cx={ghost[0]} cy={ghost[1]} r={10} fill={YELLOW} opacity={pathIn > 0 && pathIn < 1 ? 1 : 0} />
              <circle
                cx={sweepPts[sweepPts.length - 1][0]}
                cy={sweepPts[sweepPts.length - 1][1]}
                r={18 * ramp(fr, 64, 80)}
                fill="none"
                stroke={YELLOW}
                strokeWidth={3}
                opacity={ramp(fr, 64, 72)}
              />
            </g>
          ) : null}

          {/* reference lines (thin, dashed) */}
          <g stroke={WHITE} strokeWidth={2} fill="none" opacity={0.6}>
            {/* horizontal in the lever plane through the pivot */}
            <path
              d={`M${fmt(g.pivot)} L${fmt(plane(0.4, 0))}`}
              strokeDasharray="6 8"
              opacity={angleIn}
            />
            {/* vertical through the pivot up to the moment arm */}
            <path
              d={`M${fmt(g.pivot)} L${fmt(plane(0, RHO * g.s + 0.07))}`}
              strokeDasharray="6 8"
              opacity={armIn}
            />
            {/* gravity line of action through the plate centre */}
            <path
              d={`M${fmt(plane(RHO * g.c, RHO * g.s + 0.09, off))} L${fmt(g.gravityTip)}`}
              strokeDasharray="6 8"
              opacity={gravityIn * 0.8}
            />
          </g>

          {/* lever: pivot -> plate centre */}
          <path
            d={`M${fmt(g.pivot)} L${fmt(g.plate)}`}
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={1 - leverIn}
            stroke={WHITE}
            strokeWidth={3}
            fill="none"
            filter="url(#glow)"
            opacity={0.9}
          />

          {/* angle indicator */}
          <g opacity={angleIn} filter="url(#glow)">
            <path d={polyline(angPts)} fill="none" stroke={CYAN} strokeWidth={3} strokeLinecap="round" />
          </g>

          {/* moment arm (magenta) */}
          <g opacity={armIn} filter="url(#glow)">
            <path
              d={`M${fmt(g.armFoot)} L${fmt(g.plate)}`}
              pathLength={1}
              strokeDasharray="1 1"
              strokeDashoffset={1 - armIn}
              stroke={MAGENTA}
              strokeWidth={6}
              strokeLinecap="round"
              fill="none"
            />
            {/* right-angle tick at the foot */}
            <path
              d={`M${fmt(plane(0, RHO * g.s - 0.04))} L${fmt(plane(0.04, RHO * g.s - 0.04))} L${fmt(plane(0.04, RHO * g.s))}`}
              stroke={MAGENTA}
              strokeWidth={2}
              fill="none"
            />
            <circle cx={g.armFoot[0]} cy={g.armFoot[1]} r={6} fill={MAGENTA} />
          </g>

          {/* outro: the moment arm the lever had at the bottom of this rep */}
          {fr >= OUTRO_AT ? (
            <g filter="url(#glow)">
              <path
                d={`M${fmt(g.plate)} L${fmt(ghostArmEnd)}`}
                pathLength={1}
                strokeDasharray="0.04 0.04"
                stroke={MAGENTA}
                strokeWidth={6}
                strokeLinecap="round"
                fill="none"
                opacity={ghostArmIn * 0.75}
              />
              <path
                d={`M${fmt(plane(RHO * Math.cos(bottomTheta), RHO * g.s + 0.03, off))} L${fmt(plane(RHO * Math.cos(bottomTheta), RHO * g.s - 0.03, off))}`}
                stroke={MAGENTA}
                strokeWidth={3}
                opacity={ghostArmIn}
              />
            </g>
          ) : null}

          {/* gravity vector */}
          <g opacity={gravityIn} filter="url(#glow)">
            <path
              d={`M${fmt(g.plate)} L${fmt(g.gravityTip)}`}
              pathLength={1}
              strokeDasharray="1 1"
              strokeDashoffset={1 - gravityIn}
              stroke={WHITE}
              strokeWidth={5}
              fill="none"
            />
            <Arrowhead from={g.plate} to={g.gravityTip} size={22} color={WHITE} opacity={ramp(fr, HOOK + 18, HOOK + 28)} />
          </g>

          {/* pivot marker */}
          <g filter="url(#glow)" opacity={pivotIn}>
            <circle
              cx={g.pivot[0]}
              cy={g.pivot[1]}
              r={18 + 26 * pulse}
              fill="none"
              stroke={WHITE}
              strokeWidth={2}
              opacity={(1 - pulse) * 0.6}
            />
            <circle cx={g.pivot[0]} cy={g.pivot[1]} r={16 * pivotIn} fill="none" stroke={WHITE} strokeWidth={3} />
            <circle cx={g.pivot[0]} cy={g.pivot[1]} r={4} fill={WHITE} />
          </g>

          {/* plate-centre tracking point */}
          <g filter="url(#glow)" opacity={plateIn}>
            <circle cx={g.plate[0]} cy={g.plate[1]} r={20 * plateIn} fill="none" stroke={WHITE} strokeWidth={2.5} />
            <circle cx={g.plate[0]} cy={g.plate[1]} r={7} fill={WHITE} />
            {[0, 90, 180, 270].map((a) => {
              const r = (a * Math.PI) / 180;
              return (
                <line
                  key={a}
                  x1={g.plate[0] + Math.cos(r) * 26}
                  y1={g.plate[1] + Math.sin(r) * 26}
                  x2={g.plate[0] + Math.cos(r) * 36}
                  y2={g.plate[1] + Math.sin(r) * 36}
                  stroke={WHITE}
                  strokeWidth={2.5}
                />
              );
            })}
          </g>
        </svg>

        {/* ---------------- labels tied to the geometry ---------------- */}
        <Label at={[g.pivot[0] - 30, g.pivot[1] + 38]} align="right" color={WHITE} opacity={pivotIn * labelsOut}>
          PIVOT
        </Label>
        <Label
          at={[(g.armFoot[0] + g.plate[0]) / 2, (g.armFoot[1] + g.plate[1]) / 2 - 40]}
          align="center"
          color={MAGENTA}
          opacity={armIn}
        >
          MOMENT ARM
        </Label>
        <Label
          at={[Math.max(24, ghostArmEnd[0] - 8), ghostArmEnd[1] - 56]}
          align="left"
          color={MAGENTA}
          opacity={ghostArmIn * 0.9}
        >
          AT BOTTOM
        </Label>
        <Label at={[g.gravityTip[0] + 34, g.gravityTip[1] - 30]} align="left" color={WHITE} opacity={gravityIn * labelsOut}>
          GRAVITY
        </Label>
        <Label at={[angLabel[0] - 14, angLabel[1] - 22]} align="right" color={CYAN} opacity={angleIn} mono>
          θ
        </Label>
      </AbsoluteFill>

      {/* legibility gradient for the top text zone */}
      {graphicsOnly ? null : (
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.45) 30%, rgba(0,0,0,0) 48%), radial-gradient(ellipse at 50% 55%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)",
          }}
        />
      )}

      {/* ---------------- hook question ---------------- */}
      <AbsoluteFill style={{ padding: "210px 80px 0", opacity: questionOut }}>
        {[
          { t: "DOES A T-BAR ROW", c: WHITE, at: 22 },
          { t: "GET HARDER", c: WHITE, at: 30 },
          { t: "AT THE TOP?", c: YELLOW, at: 38 },
        ].map((l) => (
          <div
            key={l.t}
            style={{
              fontFamily: inter,
              fontWeight: 800,
              fontSize: 96,
              lineHeight: 1.04,
              letterSpacing: "-0.02em",
              color: l.c,
              textShadow: "0 4px 30px rgba(0,0,0,0.6)",
              opacity: ramp(fr, l.at, l.at + 14),
              translate: `0px ${interpolate(ramp(fr, l.at, l.at + 18), [0, 1], [36, 0])}px`,
            }}
          >
            {l.t}
          </div>
        ))}
      </AbsoluteFill>

      {/* ---------------- live readouts ---------------- */}
      <AbsoluteFill style={{ padding: "170px 80px 0", opacity: readoutIn }}>
        <Readout label="LEVER ANGLE" value={`${deg(theta).toFixed(1)}°`} />
        <div style={{ height: 26 }} />
        <Readout label="MACHINE TORQUE" value={`${Math.round(torque * 100)}%`} />
        <div style={{ fontFamily: inter, fontWeight: 500, fontSize: 24, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>
          relative · 100% = lever horizontal
        </div>
        <svg width={SPARK_W + 20} height={SPARK_H + 20} style={{ marginTop: 22, overflow: "visible" }}>
          <line x1={0} y1={0} x2={SPARK_W} y2={0} stroke="rgba(255,255,255,0.18)" strokeWidth={1.5} strokeDasharray="4 6" />
          <text x={SPARK_W + 10} y={6} fill="rgba(255,255,255,0.5)" fontFamily={mono} fontSize={20}>
            100
          </text>
          <line x1={0} y1={SPARK_H} x2={SPARK_W} y2={SPARK_H} stroke="rgba(255,255,255,0.18)" strokeWidth={1.5} strokeDasharray="4 6" />
          <text x={SPARK_W + 10} y={SPARK_H + 6} fill="rgba(255,255,255,0.5)" fontFamily={mono} fontSize={20}>
            75
          </text>
          {sparkPts.length > 1 ? (
            <g filter="url(#glow)">
              <path d={polyline(sparkPts)} fill="none" stroke={CYAN} strokeWidth={3} strokeLinejoin="round" />
              <circle cx={sparkPts[sparkPts.length - 1][0]} cy={sparkPts[sparkPts.length - 1][1]} r={6} fill={CYAN} />
            </g>
          ) : null}
        </svg>
      </AbsoluteFill>

      {/* ---------------- outro answer ---------------- */}
      <AbsoluteFill style={{ padding: "190px 80px 0", opacity: outroIn }}>
        <div style={{ fontFamily: inter, fontWeight: 700, fontSize: 44, letterSpacing: "0.06em", color: WHITE }}>
          AT THE TOP, MACHINE TORQUE
        </div>
        <div
          style={{
            fontFamily: mono,
            fontWeight: 700,
            fontSize: 168,
            lineHeight: 1.05,
            letterSpacing: "-0.05em",
            color: CYAN,
            textShadow: `0 0 28px ${CYAN}66`,
            translate: `0px ${interpolate(outroIn, [0, 1], [24, 0])}px`,
          }}
        >
          −{Math.round(drop * 100)}%
        </div>
        <div style={{ fontFamily: inter, fontWeight: 700, fontSize: 32, letterSpacing: "0.12em", color: CYAN, marginTop: -4 }}>
          VS THE BOTTOM OF THE SAME REP
        </div>
        <div style={{ fontFamily: inter, fontWeight: 500, fontSize: 42, lineHeight: 1.3, color: "rgba(255,255,255,0.9)", marginTop: 10, maxWidth: 900 }}>
          The moment arm shrinks as the lever rises.
          <br />
          <span style={{ color: YELLOW }}>Feels harder?</span> That&apos;s your back working at short length — not the machine.
        </div>
        <div style={{ fontFamily: inter, fontWeight: 500, fontSize: 24, lineHeight: 1.35, color: "rgba(255,255,255,0.55)", marginTop: 22, maxWidth: 880 }}>
          Lever angle measured from video (±4°). Torque = plates + lever about the machine pivot, relative to
          lever horizontal; not muscle force.
        </div>
      </AbsoluteFill>

      {/* series tag */}
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 96,
          fontFamily: inter,
          fontWeight: 700,
          fontSize: 24,
          letterSpacing: "0.32em",
          color: "rgba(255,255,255,0.6)",
          opacity: ramp(fr, 0, 12),
        }}
      >
        LEVER LAB · RDH COACHING
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// source frame START_SRC is local frame 0 (60 fps composition = 60 fps source)
const Footage: React.FC = () => (
  <Video
    src={staticFile("tbar.mp4")}
    trimBefore={START_SRC}
    muted
    objectFit="fill"
    style={{ width: OUT_W, height: OUT_H }}
  />
);

const Label: React.FC<{
  at: Pt;
  align: "left" | "right" | "center";
  color: string;
  opacity: number;
  mono?: boolean;
  children: React.ReactNode;
}> = ({ at, align, color, opacity, mono: useMono, children }) => (
  <div
    style={{
      position: "absolute",
      left: at[0],
      top: at[1],
      translate: align === "right" ? "-100% -50%" : align === "center" ? "-50% -50%" : "0 -50%",
      fontFamily: useMono ? mono : inter,
      fontWeight: 700,
      fontSize: useMono ? 40 : 28,
      letterSpacing: useMono ? 0 : "0.18em",
      color,
      opacity,
      whiteSpace: "nowrap",
      textShadow: "0 2px 12px rgba(0,0,0,0.9)",
    }}
  >
    {children}
  </div>
);

const Arrowhead: React.FC<{ from: Pt; to: Pt; size: number; color: string; opacity: number }> = ({
  from,
  to,
  size,
  color,
  opacity,
}) => {
  const a = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const p = (r: number, da: number): string =>
    `${(to[0] + Math.cos(a + da) * r).toFixed(2)} ${(to[1] + Math.sin(a + da) * r).toFixed(2)}`;
  return (
    <path
      d={`M${p(size * 0.35, 0)} L${p(size, Math.PI - 0.42)} L${p(size, Math.PI + 0.42)} Z`}
      fill={color}
      opacity={opacity}
    />
  );
};

const Readout: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div style={{ fontFamily: inter, fontWeight: 700, fontSize: 26, letterSpacing: "0.2em", color: "rgba(255,255,255,0.7)" }}>
      {label}
    </div>
    <div
      style={{
        fontFamily: mono,
        fontWeight: 700,
        fontSize: 104,
        lineHeight: 1.0,
        color: CYAN,
        fontVariantNumeric: "tabular-nums",
        textShadow: `0 0 24px ${CYAN}55`,
      }}
    >
      {value}
    </div>
  </div>
);
