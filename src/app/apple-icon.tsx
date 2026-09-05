import { ImageResponse } from "next/og";

// iOS home-screen icon. Apple ignores SVG favicons, so this renders the same
// mark as icon.svg to PNG at build time. Node runtime (never edge) per the
// project's runtime rule; there's no DB access here, but the rule is blanket.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const OPEN = "#fafafa";
const BLOCKED = "#163275";

/** Same 3x3 pattern as icon.svg: two blocked corners, seven open squares. */
const CELLS = [
  [OPEN, OPEN, BLOCKED],
  [OPEN, OPEN, OPEN],
  [BLOCKED, OPEN, OPEN],
];

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, #4874d8 0%, #3862c4 100%)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {CELLS.map((row, y) => (
            <div key={y} style={{ display: "flex", gap: 7 }}>
              {row.map((fill, x) => (
                <div
                  key={x}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 7,
                    background: fill,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
