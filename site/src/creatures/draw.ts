/** Paints one creature frame onto the ASCII grid in the same block-and-glyph style as the sharks. */
import type { Grid } from "../../../vendor-ascii-sharks/src/renderer.ts";
import { forLightCanvas } from "./color.ts";
import { BELLY, MARKS, type Mask, sampleCell } from "./mask.ts";
import type { Frame } from "./timeline.ts";

export type Colors = { body: string; belly: string; marks: string };

const SKIN = ":;t%SX8#@";
const EDGE = ".',`";
const SHIMMER = ["#e0892c", "#33c8cc", "#b44ae0", "#3150e8"];

const rgbOf = (hex: string): [number, number, number] => {
  const v = parseInt(hex.replace("#", ""), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
/** Integer hash in [0, 1), stable per cell. */
const hash = (a: number, b: number, c: number) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export function drawCreature(ctx: CanvasRenderingContext2D, grid: Grid, mask: Mask, f: Frame, colors: Colors, light: boolean) {
  if (!mask.w) return;
  const { cw, ch, cols, rows, t } = grid;
  const wPx = f.widthCells * cw;
  const hPx = wPx * (mask.h / mask.w) * f.squash;
  const left = f.x - wPx / 2, top = f.y - hPx / 2;
  // The canvas is CSS-filtered in light mode, so pre-correct to keep the creature's own colours.
  const paint = (r: number, g: number, b: number, k = f.brightness) => {
    let c = [r * k, g * k, b * k].map((v) => Math.max(0, Math.min(255, Math.round(v)))) as [number, number, number];
    if (light) c = forLightCanvas(c);
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  };
  const body = rgbOf(colors.body), belly = rgbOf(colors.belly), marks = rgbOf(colors.marks);
  const tick = Math.floor(t * 2.4);

  const c0 = Math.max(0, Math.floor(left / cw)), c1 = Math.min(cols - 1, Math.floor((left + wPx) / cw));
  const r0 = Math.max(0, Math.floor(top / ch)), r1 = Math.min(rows - 1, Math.floor((top + hPx) / ch));
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const s = sampleCell(mask, (c * cw - left) / wPx, (r * ch - top) / hPx, ((c + 1) * cw - left) / wPx, ((r + 1) * ch - top) / hPx);
      if (s.coverage < 0.18) continue;
      const x = c * cw, y = r * ch;
      if (s.coverage < 0.55) {
        ctx.fillStyle = paint(body[0] * 0.6, body[1] * 0.6, body[2] * 0.6);
        ctx.fillText(EDGE[(c * 7 + r * 3) % EDGE.length], x + cw / 2, y + ch / 2 + 1);
        continue;
      }
      const shade = 0.82 + 0.18 * hash(c, r, 1);
      const base = s.region === MARKS ? marks : s.region === BELLY ? belly : body;
      const shimmer = f.phase === "flight" && hash(c, r, tick) < 0.04;
      ctx.fillStyle = shimmer ? paint(...rgbOf(SHIMMER[(c + r) % 4]), 1) : paint(base[0] * shade, base[1] * shade, base[2] * shade);
      ctx.fillRect(x + 1, y + 1, cw - 1, ch - 1);
      const glyph = s.region === MARKS ? "#" : s.region === BELLY ? ":" : SKIN[Math.min(SKIN.length - 1, Math.floor((1 - shade) * 5 * 8.99))];
      ctx.fillStyle = s.region === MARKS ? paint(marks[0] * 2.2, marks[1] * 2.2, marks[2] * 2.2) : paint(14, 15, 19);
      ctx.fillText(glyph, x + cw / 2, y + ch / 2 + 1);
    }
  }
}
