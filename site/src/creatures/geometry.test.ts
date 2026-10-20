import { assertAlmostEquals } from "jsr:@std/assert@1.0.8";
import { cellToUV } from "./geometry.ts";

const s = { x: 100, y: 50, wPx: 40, hPx: 20, angle: 0 };

Deno.test("cellToUV maps the centre to the middle", () => {
  const { u, v } = cellToUV(100, 50, s);
  assertAlmostEquals(u, 0.5, 1e-9);
  assertAlmostEquals(v, 0.5, 1e-9);
});

Deno.test("cellToUV maps the right edge at angle 0", () => {
  const { u, v } = cellToUV(120, 50, s);
  assertAlmostEquals(u, 1, 1e-9);
  assertAlmostEquals(v, 0.5, 1e-9);
});

Deno.test("cellToUV follows a quarter turn", () => {
  // Turned 90° clockwise (y down), the sprite's right edge points down.
  const { u, v } = cellToUV(100, 70, { ...s, angle: Math.PI / 2 });
  assertAlmostEquals(u, 1, 1e-9);
  assertAlmostEquals(v, 0.5, 1e-9);
});
