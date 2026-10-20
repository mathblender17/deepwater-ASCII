import { assert, assertEquals } from "jsr:@std/assert@1.0.8";
import { cellToUV, orient } from "./geometry.ts";

const deg = (d: number) => (d * Math.PI) / 180;

Deno.test("a left-facing image travelling right is mirrored, not turned belly-up", () => {
  const o = orient(0, deg(153));
  assertEquals(o.flip, true);
  assert(Math.abs(o.rot) <= deg(90), `turned ${(o.rot * 180) / Math.PI}°`);
});

Deno.test("a left-facing image travelling left is just turned a little", () => {
  const o = orient(deg(175), deg(153));
  assertEquals(o.flip, false);
  assert(Math.abs(o.rot) <= deg(90));
});

Deno.test("mirroring flips u", () => {
  const s = { x: 100, y: 50, wPx: 40, hPx: 20, angle: 0 };
  assertEquals(cellToUV(110, 50, { ...s, flip: true }).u, 0.25);
});
