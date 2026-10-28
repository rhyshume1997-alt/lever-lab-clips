import { Composition } from "remotion";
import { OUT_H, OUT_W } from "./geometry";
import { TOTAL_FRAMES, TbarRow } from "./TbarRow";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TbarRow"
        component={TbarRow}
        durationInFrames={TOTAL_FRAMES}
        fps={60}
        width={OUT_W}
        height={OUT_H}
        defaultProps={{ graphicsOnly: false }}
      />
      <Composition
        id="TbarRowGraphics"
        component={TbarRow}
        durationInFrames={TOTAL_FRAMES}
        fps={60}
        width={OUT_W}
        height={OUT_H}
        defaultProps={{ graphicsOnly: true }}
        calculateMetadata={() => ({
          defaultCodec: "prores",
          defaultVideoImageFormat: "png",
          defaultPixelFormat: "yuva444p10le",
          defaultProResProfile: "4444",
        })}
      />
      <Composition
        id="TbarRowGraphicsOnBlack"
        component={TbarRow}
        durationInFrames={TOTAL_FRAMES}
        fps={60}
        width={OUT_W}
        height={OUT_H}
        defaultProps={{ graphicsOnly: true, blackBackground: true }}
      />
    </>
  );
};
