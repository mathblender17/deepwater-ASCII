/** Paints a serpent body (Gyarados) on the ASCII grid: a tapering band with a belly side, fins, and a rotated head. */
import type { Grid } from "../../../vendor-ascii-sharks/src/renderer.ts";
import { type Colors, drawSprite, hash, painter, rgbOf } from "./draw.ts";
import type { Mask } from "./mask.ts";
import type { Serpent } from "./scene.ts";
import { NODES } from "./swivel.ts";

const SKIN = ":;t%SX8#@";
const HEAD_CELLS = 20;

export function drawSerpent(ctx: CanvasRenderingContext2D, grid: Grid, s: Serpent, head: Mask | null, colors: Colors, light: boolean, headFacing: number) {
  const { cw, ch, cols, rows } = grid;
  const n = s.nodes;
  if (n.length < 2) return;
  const paint = painter(s.brightness, light);
  const body = rgbOf(colors.body), belly = rgbOf(colors.belly ?? colors.body), fin = rgbOf(colors.fin ?? colors.belly ?? colors.body);
  const marks = rgbOf(colors.marks ?? colors.body);
  const halfW = (k: number) => ((s.widthCells * cw) / 2) * (1 - 0.65 * (k / (NODES - 1)));
  const maxW = halfW(0) * 2;

  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of n) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  const c0 = Math.max(0, Math.floor((x0 - maxW) / cw)), c1 = Math.min(cols - 1, Math.floor((x1 + maxW) / cw));
  const r0 = Math.max(0, Math.floor((y0 - maxW) / ch)), r1 = Math.min(rows - 1, Math.floor((y1 + maxW) / ch));

  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const px = c * cw + cw / 2, py = r * ch + ch / 2;
      // Nearest point on the spine: which segment, how far along it, and on which side.
      let best = Infinity, side = 0, k = 0, along = 0;
      for (let i = 0; i < n.length - 1; i++) {
        const ax = n[i].x, ay = n[i].y, bx = n[i + 1].x, by = n[i + 1].y;
        const vx = bx - ax, vy = by - ay, vv = vx * vx + vy * vy || 1;
        const q = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / vv));
        const dx = px - (ax + vx * q), dy = py - (ay + vy * q);
        const d = Math.hypot(dx, dy);
        if (d < best) { best = d; side = vx * dy - vy * dx; k = n[i].k + (n[i + 1].k - n[i].k) * q; along = q; }
      }
      const hw = halfW(k);
      const x = c * cw, y = r * ch;
      // Fin spikes on the back, every third segment.
      const spike = Math.round(k) % 3 === 0 && Math.abs(along - 0.5) < 0.35;
      if (best > hw) {
        if (spike && side < 0 && best < hw * 1.9) {
          ctx.fillStyle = paint(fin[0], fin[1], fin[2]);
          ctx.fillRect(x + 1, y + 1, cw - 1, ch - 1);
          ctx.fillStyle = paint(14, 15, 19);
          ctx.fillText(":", x + cw / 2, y + ch / 2 + 1);
        }
        continue;
      }
      const isBelly = side > 0 && best > hw * 0.3;
      const joint = Math.abs(along - 0.5) > 0.42;
      const edge = best > hw * 0.82;
      const shade = (joint ? 0.78 : 0.9) + 0.1 * hash(c, r, 3);
      const base = edge ? marks : isBelly ? belly : body;
      ctx.fillStyle = paint(base[0] * shade, base[1] * shade, base[2] * shade);
      ctx.fillRect(x + 1, y + 1, cw - 1, ch - 1);
      const glyph = isBelly ? ":" : SKIN[Math.min(SKIN.length - 1, Math.floor((1 - shade) * 5 * 8.99))];
      ctx.fillStyle = paint(14, 15, 19);
      ctx.fillText(glyph, x + cw / 2, y + ch / 2 + 1);
    }
  }

  if (s.headVisible && head) {
    drawSprite(ctx, grid, head, {
      pose: "main", x: n[0].x, y: n[0].y, widthCells: HEAD_CELLS, brightness: s.brightness, squash: 1, angle: s.angle, layer: "over",
    }, colors, light, headFacing);
  }
}
