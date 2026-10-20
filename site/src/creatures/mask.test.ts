import { assert, assertEquals } from "jsr:@std/assert@1.0.8";
import { BELLY, BODY, buildMask, MARKS, sampleCell } from "./mask.ts";

type RGB = [number, number, number];

function image(w: number, h: number, paint: (x: number, y: number) => RGB | null, alpha = 255) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const c = paint(x, y);
      // Painted checkerboard "transparency", the way many downloaded PNGs ship.
      const [r, g, b] = c ?? (((x >> 3) + (y >> 3)) % 2 ? [255, 255, 255] : [230, 230, 230]);
      px.set([r, g, b, alpha], i);
    }
  }
  return px;
}

/** A 20×20 square at 10..29 with a 1-px dark outline; `fill` paints its interior. */
const square = (fill: (x: number, y: number) => RGB) => (x: number, y: number): RGB | null => {
  if (x < 10 || x > 29 || y < 10 || y > 29) return null;
  if (x === 10 || x === 29 || y === 10 || y === 29) return [20, 20, 20];
  return fill(x, y);
};

Deno.test("checkerboard background is removed", () => {
  const m = buildMask(image(40, 40, square(() => [238, 241, 246])), 40, 40);
  assertEquals([m.w, m.h], [20, 20]);
  assert(m.coverage > 0.95, `coverage ${m.coverage}`);
});

Deno.test("enclosed white counts as inside", () => {
  const m = buildMask(image(40, 40, square(() => [255, 255, 255])), 40, 40);
  assertEquals([m.w, m.h], [20, 20]);
  assert(m.coverage > 0.95, `coverage ${m.coverage}`);
});

Deno.test("regions are labelled", () => {
  const fill = (x: number, y: number): RGB => {
    if (x >= 12 && x < 18 && y >= 12 && y < 18) return [44, 54, 120]; // navy marking
    if (x >= 21 && x < 27 && y >= 21 && y < 27) return [169, 188, 232]; // pale-blue belly
    return [238, 241, 246];
  };
  const m = buildMask(image(40, 40, square(fill)), 40, 40);
  // The mask is cropped to 10..29, so pixel p sits at (p - 10) / 20.
  const cell = (a: number, b: number) => sampleCell(m, (a - 10) / 20, (a - 10) / 20, (b - 10) / 20, (b - 10) / 20);
  assertEquals(cell(13, 17).region, MARKS);
  assertEquals(cell(22, 26).region, BELLY);
  assertEquals(sampleCell(m, (19 - 10) / 20, (12 - 10) / 20, (21 - 10) / 20, (17 - 10) / 20).region, BODY);
});

Deno.test("alpha images use alpha", () => {
  const w = 30, h = 30;
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 10; y < 20; y++) for (let x = 10; x < 20; x++) px.set([255, 255, 255, 255], (y * w + x) * 4);
  const m = buildMask(px, w, h);
  assertEquals(m.w, 10);
});

Deno.test("empty image", () => {
  const m = buildMask(image(24, 24, () => null), 24, 24);
  assertEquals(m.w, 0);
  assertEquals(m.coverage, 0);
});

Deno.test("lavender-shaded body stays body, not belly", () => {
  // Lugia's white body is shaded with a lavender tint; only the clearly blue belly is BELLY.
  const m = buildMask(image(40, 40, square(() => [215, 220, 242])), 40, 40);
  assertEquals(sampleCell(m, 0.3, 0.3, 0.7, 0.7).region, BODY);
});
