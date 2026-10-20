/** Draws circles forming on the water (deep teal inside, a soft glowing rim) and foam rings from a surfacing or dive. */
import type { Grid } from "../../../vendor-ascii-sharks/src/renderer.ts";
import { forLightCanvas } from "./color.ts";
import type { Circle, Foam, Scene } from "./scene.ts";

const DEEP: [number, number, number] = [10, 52, 82];
const RIM: [number, number, number] = [110, 214, 240];
const FOAM: [number, number, number] = [223, 246, 255];
const FOAM_RINGS = [[0, 0.7], [0.13, 0.4], [0.26, 0.2]] as const;

export function drawWater(ctx: CanvasRenderingContext2D, grid: Grid, scene: Scene, light: boolean) {
  const col = (c: [number, number, number], a: number) => {
    const [r, g, b] = light ? forLightCanvas(c) : c;
    return `rgba(${r},${g},${b},${a.toFixed(3)})`;
  };
  for (const c of scene.circles) if (c.r > 0) drawCircle(ctx, grid, c, col);
  for (const f of scene.foams) drawFoam(ctx, grid, f, col);
}

type Col = (c: [number, number, number], a: number) => string;

function cellsAround(grid: Grid, x: number, y: number, reach: number, each: (c: number, r: number, d: number) => void) {
  const { cw, ch, cols, rows } = grid;
  const c0 = Math.max(0, Math.floor((x - reach) / cw)), c1 = Math.min(cols - 1, Math.floor((x + reach) / cw));
  const r0 = Math.max(0, Math.floor((y - reach) / ch)), r1 = Math.min(rows - 1, Math.floor((y + reach) / ch));
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) each(c, r, Math.hypot(c * cw + cw / 2 - x, r * ch + ch / 2 - y));
}

function drawCircle(ctx: CanvasRenderingContext2D, grid: Grid, k: Circle, col: Col) {
  const { cw, ch, t } = grid;
  // Calm, not loud: the rim breathes slowly and everything stays below full opacity.
  const breathe = 0.85 + 0.15 * Math.sin(t * 2.2);
  cellsAround(grid, k.x, k.y, k.r + cw, (c, r, d) => {
    const style = d < k.r - cw * 0.6 ? col(DEEP, 0.78 * k.tint)
      : d < k.r + cw * 0.6 ? col(RIM, 0.55 * breathe * Math.min(1, k.tint + 0.3)) : null;
    if (!style) return;
    ctx.fillStyle = style;
    ctx.fillRect(c * cw + 1, r * ch + 1, cw - 1, ch - 1);
  });
}

function drawFoam(ctx: CanvasRenderingContext2D, grid: Grid, f: Foam, col: Col) {
  const { cw, ch } = grid;
  const lead = f.progress * f.reach;
  cellsAround(grid, f.x, f.y, lead + 2 * cw, (c, r, d) => {
    // A soft foam ring spreading from the centre, with two fainter ones behind it, laid over the water.
    for (const [lag, alpha] of FOAM_RINGS) {
      const rr = lead - lag * f.reach;
      if (rr > 0 && Math.abs(d - rr) < cw * 0.9) {
        ctx.fillStyle = col(FOAM, alpha * (1 - f.progress));
        ctx.fillRect(c * cw + 1, r * ch + 1, cw - 1, ch - 1);
        return;
      }
    }
  });
}
