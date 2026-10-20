/** Draws the circle forming on the water: deep teal inside, a soft glowing rim, and the foam rings of the breach. */
import type { Grid } from "../../../vendor-ascii-sharks/src/renderer.ts";
import { forLightCanvas } from "./color.ts";
import { discRadius, type Frame } from "./timeline.ts";

const DEEP: [number, number, number] = [10, 52, 82];
const RIM: [number, number, number] = [110, 214, 240];
const FOAM: [number, number, number] = [223, 246, 255];

export { discRadius };

export function drawWater(ctx: CanvasRenderingContext2D, grid: Grid, f: Frame, light: boolean) {
  const { cw, ch, cols, rows, t } = grid;
  const R = f.zone * discRadius(cw);
  const foamR = f.ring === null ? -1 : f.ring * discRadius(cw) * 2.2;
  const reach = Math.max(R + cw, foamR + 2 * cw);
  if (reach <= 0) return;
  const col = (c: [number, number, number], a: number) => {
    const [r, g, b] = light ? forLightCanvas(c) : c;
    return `rgba(${r},${g},${b},${a.toFixed(3)})`;
  };
  // Calm, not loud: the rim breathes slowly and everything stays below full opacity.
  const breathe = 0.85 + 0.15 * Math.sin(t * 2.2);

  const c0 = Math.max(0, Math.floor((f.cx - reach) / cw)), c1 = Math.min(cols - 1, Math.floor((f.cx + reach) / cw));
  const r0 = Math.max(0, Math.floor((f.cy - reach) / ch)), r1 = Math.min(rows - 1, Math.floor((f.cy + reach) / ch));
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const d = Math.hypot(c * cw + cw / 2 - f.cx, r * ch + ch / 2 - f.cy);
      const x = c * cw + 1, y = r * ch + 1;
      const base = d < R - cw * 0.6 ? col(DEEP, 0.78 * f.tint)
        : d < R + cw * 0.6 ? col(RIM, 0.55 * breathe * Math.min(1, f.tint + 0.3)) : null;
      if (base) {
        ctx.fillStyle = base;
        ctx.fillRect(x, y, cw - 1, ch - 1);
      }
      if (f.ring === null) continue;
      // A soft foam ring spreading from the centre, with two fainter ones behind it, laid over the water.
      for (const [lag, alpha] of [[0, 0.7], [0.13, 0.4], [0.26, 0.2]] as const) {
        const rr = foamR - lag * discRadius(cw) * 2.2;
        if (rr > 0 && Math.abs(d - rr) < cw * 0.9) {
          ctx.fillStyle = col(FOAM, alpha * (1 - f.ring));
          ctx.fillRect(x, y, cw - 1, ch - 1);
          break;
        }
      }
    }
  }
}
