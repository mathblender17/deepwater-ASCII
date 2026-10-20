/** Paints a creature sprite onto the ASCII grid in the same block-and-glyph style as the sharks. */
import type { Grid } from "../../../vendor-ascii-sharks/src/renderer.ts";
import { forLightCanvas } from "./color.ts";
import { cellToUV } from "./geometry.ts";
import { BELLY, BODY, FIN, MARKS, type Mask, sampleCell } from "./mask.ts";
import type { Sprite } from "./scene.ts";

/** Paint colour per region name: body, belly, marks, fin. */
export type Colors = Record<string, string>;

const SKIN = ":;t%SX8#@";
const EDGE = ".',`";
const SHIMMER = ["#e0892c", "#33c8cc", "#b44ae0", "#3150e8"];
const REGION_NAMES = ["", "body", "belly", "marks", "fin"];

export const rgbOf = (hex: string): [number, number, number] => {
  const v = parseInt(hex.replace("#", ""), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
/** Integer hash in [0, 1), stable per cell. */
export const hash = (a: number, b: number, c: number) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** A colour painter that applies brightness and, in light mode, the canvas filter's correction. */
export const painter = (brightness: number, light: boolean) => (r: number, g: number, b: number, k = brightness) => {
  let c = [r * k, g * k, b * k].map((v) => Math.max(0, Math.min(255, Math.round(v)))) as [number, number, number];
  if (light) c = forLightCanvas(c);
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};

/** `facing` is the angle (radians) the source image faces; the sprite is turned so that direction points along `s.angle`. */
export function drawSprite(ctx: CanvasRenderingContext2D, grid: Grid, mask: Mask, s: Sprite, colors: Colors, light: boolean, facing = 0) {
  if (!mask.w) return;
  const { cw, ch, cols, rows, t } = grid;
  const wPx = s.widthCells * cw;
  const hPx = wPx * (mask.h / mask.w) * s.squash;
  const box = { x: s.x, y: s.y, wPx, hPx, angle: s.angle - facing };
  const reach = Math.hypot(wPx, hPx) / 2;
  const paint = painter(s.brightness, light);
  const rgb = REGION_NAMES.map((n) => rgbOf(colors[n] ?? colors.body));
  const body = rgb[BODY];
  const tick = Math.floor(t * 2.4);
  const du = cw / wPx, dv = ch / hPx;

  const c0 = Math.max(0, Math.floor((s.x - reach) / cw)), c1 = Math.min(cols - 1, Math.floor((s.x + reach) / cw));
  const r0 = Math.max(0, Math.floor((s.y - reach) / ch)), r1 = Math.min(rows - 1, Math.floor((s.y + reach) / ch));
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const { u, v } = cellToUV(c * cw + cw / 2, r * ch + ch / 2, box);
      if (u < -du || u > 1 + du || v < -dv || v > 1 + dv) continue;
      const smp = sampleCell(mask, u - du / 2, v - dv / 2, u + du / 2, v + dv / 2);
      if (smp.coverage < 0.18) continue;
      const x = c * cw, y = r * ch;
      if (smp.coverage < 0.55) {
        ctx.fillStyle = paint(body[0] * 0.6, body[1] * 0.6, body[2] * 0.6);
        ctx.fillText(EDGE[(c * 7 + r * 3) % EDGE.length], x + cw / 2, y + ch / 2 + 1);
        continue;
      }
      const shade = 0.82 + 0.18 * hash(c, r, 1);
      const base = rgb[smp.region] ?? body;
      const shimmer = s.layer === "over" && s.brightness >= 1 && hash(c, r, tick) < 0.04;
      ctx.fillStyle = shimmer ? paint(...rgbOf(SHIMMER[(c + r) % 4]), 1) : paint(base[0] * shade, base[1] * shade, base[2] * shade);
      ctx.fillRect(x + 1, y + 1, cw - 1, ch - 1);
      const glyph = smp.region === MARKS ? "#" : smp.region === BELLY || smp.region === FIN ? ":" : SKIN[Math.min(SKIN.length - 1, Math.floor((1 - shade) * 5 * 8.99))];
      ctx.fillStyle = smp.region === MARKS ? paint(base[0] * 2.2, base[1] * 2.2, base[2] * 2.2) : paint(14, 15, 19);
      ctx.fillText(glyph, x + cw / 2, y + ch / 2 + 1);
    }
  }
}
