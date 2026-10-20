/**
 * Turns a creature image into a region mask: which pixels are body, belly or
 * markings, cropped to the creature. Works on transparent PNGs and on images
 * with a painted checkerboard "transparency".
 */
export const EMPTY = 0, BODY = 1, BELLY = 2, MARKS = 3;

export type Mask = { w: number; h: number; px: Uint8Array; coverage: number };

const lumOf = (r: number, g: number, b: number) => (0.3 * r + 0.59 * g + 0.11 * b) / 255;

export function buildMask(rgba: Uint8ClampedArray, w: number, h: number): Mask {
  const n = w * h;
  let translucent = 0;
  for (let i = 0; i < n; i++) if (rgba[i * 4 + 3] < 250) translucent++;
  const useAlpha = translucent > n * 0.05;

  let inside = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
    const background = useAlpha
      ? rgba[i * 4 + 3] < 128
      : lumOf(r, g, b) > 0.75 && Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(b - r)) <= 4;
    inside[i] = background ? 0 : 1;
  }

  // Close small gaps in the outline: dilate, then erode, by 2 px.
  inside = morph(morph(inside, w, h, 2, 1), w, h, 2, 0);

  // Fill holes: anything the border can't reach through background is inside.
  const reached = new Uint8Array(n);
  const stack: number[] = [];
  const push = (i: number) => {
    if (!inside[i] && !reached[i]) { reached[i] = 1; stack.push(i); }
  };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }

  let x0 = w, y0 = h, x1 = -1, y1 = -1, count = 0;
  for (let i = 0; i < n; i++) {
    if (reached[i]) continue;
    const x = i % w, y = (i / w) | 0;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
    count++;
  }
  if (!count) return { w: 0, h: 0, px: new Uint8Array(0), coverage: 0 };

  const mw = x1 - x0 + 1, mh = y1 - y0 + 1;
  const px = new Uint8Array(mw * mh);
  for (let y = 0; y < mh; y++) {
    for (let x = 0; x < mw; x++) {
      const i = (y + y0) * w + (x + x0);
      if (reached[i]) continue;
      const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
      const lum = lumOf(r, g, b);
      px[y * mw + x] = lum < 0.45 && b - r > 30 ? MARKS : lum >= 0.45 && b - r > 45 ? BELLY : BODY;
    }
  }
  return { w: mw, h: mh, px, coverage: count / (mw * mh) };
}

/** Square-window dilate (value 1) or erode (value 0). */
function morph(src: Uint8Array, w: number, h: number, r: number, value: 0 | 1) {
  const out = new Uint8Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let hit = value === 0 ? 1 : 0;
      for (let dy = -r; dy <= r && hit !== value; dy++) {
        const yy = y + dy;
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx;
          // Off-image counts as background, so erosion never grows the shape at the border.
          const v = yy < 0 || yy >= h || xx < 0 || xx >= w ? 0 : src[yy * w + xx];
          if (v === value) { hit = value; break; }
        }
      }
      out[y * w + x] = hit;
    }
  }
  return out;
}

/** Coverage and dominant region of the mask rectangle u0..u1 × v0..v1 (fractions of the mask). */
export function sampleCell(m: Mask, u0: number, v0: number, u1: number, v1: number) {
  if (!m.w) return { coverage: 0, region: EMPTY };
  const xa = Math.max(0, Math.floor(u0 * m.w)), xb = Math.min(m.w, Math.max(xa + 1, Math.ceil(u1 * m.w)));
  const ya = Math.max(0, Math.floor(v0 * m.h)), yb = Math.min(m.h, Math.max(ya + 1, Math.ceil(v1 * m.h)));
  if (xa >= xb || ya >= yb) return { coverage: 0, region: EMPTY };
  const counts = [0, 0, 0, 0];
  for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) counts[m.px[y * m.w + x]]++;
  const total = (xb - xa) * (yb - ya);
  let region = EMPTY;
  for (const k of [BODY, BELLY, MARKS]) if (counts[k] > (region ? counts[region] : 0)) region = k;
  return { coverage: (total - counts[EMPTY]) / total, region };
}
