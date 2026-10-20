import { assert } from "jsr:@std/assert@1.0.8";
import { forLightCanvas } from "./color.ts";

// What the page's light-mode CSS does to the canvas: invert(1) then hue-rotate(180deg).
const hueRotate180 = ([r, g, b]: number[]) => [
  -0.574 * r + 1.43 * g + 0.144 * b,
  0.426 * r + 0.43 * g + 0.144 * b,
  0.426 * r + 1.43 * g - 0.856 * b,
].map((v) => Math.max(0, Math.min(255, v)));
const lightFilter = (c: number[]) => hueRotate180(c.map((v) => 255 - v));

Deno.test("pre-corrected colours survive the light-mode filter", () => {
  for (const c of [[169, 188, 232], [44, 54, 120], [238, 241, 246]]) {
    const seen = lightFilter(forLightCanvas(c as [number, number, number]));
    const err = Math.max(...seen.map((v, i) => Math.abs(v - c[i])));
    // Saturated navy loses a few points to clamping (the rotated blue goes below 0); invisible at this size.
    assert(err <= 8, `${c} came out as ${seen.map(Math.round)} (off by ${err.toFixed(1)})`);
  }
});
