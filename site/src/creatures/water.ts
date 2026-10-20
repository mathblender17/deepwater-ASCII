/** Recolours the sea around a rising creature: a deep inner disc, a rippling outer halo, and the breach rings. */
import type { Grid } from "../../../vendor-ascii-sharks/src/renderer.ts";
import { forLightCanvas } from "./color.ts";
import type { Frame } from "./timeline.ts";

const DEEP: [number, number, number] = [10, 52, 82];
const HALO: [number, number, number] = [63, 182, 214];
const FOAM: [number, number, number] = [223, 246, 255];

/** Radius of the fully opened disc, px; matches clearZones' disc. */
export const discRadius = (cw: number) => 1.5 * (45 * cw) / 2;

export function drawWater(ctx: CanvasRenderingContext2D, grid: Grid, f: Frame, light: boolean) {
  const { cw, ch, cols, rows, t } = grid;
  const R = f.zone * discRadius(cw);
  const ringR = f.ring === null ? -1 : f.ring * discRadius(cw) * 2.4;
  const reach = Math.max(R * 1.1, ringR + 2 * cw);
  if (reach <= 0) return;
  const col = (c: [number, number, number], a: number) => {
    const [r, g, b] = light ? forLightCanvas(c) : c;
    return `rgba(${r},${g},${b},${a.toFixed(3)})`;
  };

  const c0 = Math.max(0, Math.floor((f.cx - reach) / cw)), c1 = Math.min(cols - 1, Math.floor((f.cx + reach) / cw));
  const r0 = Math.max(0, Math.floor((f.cy - reach) / ch)), r1 = Math.min(rows - 1, Math.floor((f.cy + reach) / ch));
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const d = Math.hypot(c * cw + cw / 2 - f.cx, r * ch + ch / 2 - f.cy);
      let style: string | null = null;
      if (d < R * 0.62) {
        style = col(DEEP, 0.9 * f.tint);
      } else if (d < R * 1.08) {
        // The halo ripples outward.
        const ripple = 0.55 + 0.45 * Math.sin(d / (cw * 1.6) - t * 4);
        style = col(HALO, 0.38 * f.tint * ripple * (1 - Math.max(0, d - R) / (R * 0.08 + 1)));
      }
      if (f.ring !== null) {
        // A bright foam ring and two fainter ones behind it.
        for (const [lag, alpha] of [[0, 0.95], [0.13, 0.55], [0.26, 0.3]] as const) {
          const rr = ringR - lag * discRadius(cw) * 2.4;
          if (rr > 0 && Math.abs(d - rr) < cw * 1.1) style = col(FOAM, alpha * (1 - f.ring));
        }
      }
      if (!style) continue;
      ctx.fillStyle = style;
      ctx.fillRect(c * cw + 1, r * ch + 1, cw - 1, ch - 1);
    }
  }
}
