import { assert, assertAlmostEquals, assertEquals } from "jsr:@std/assert@1.0.8";
import { frameAt, nextGap, TOTAL } from "./timeline.ts";

const start = { x: 720, y: 450 };
const view = { w: 1440, h: 900, cw: 12 };
const aspect = 0.77;
const at = (t: number) => frameAt(t, start, view, aspect);

Deno.test("phases run in order", () => {
  assertEquals(at(0.5)?.phase, "deep");
  assertEquals(at(3.3)?.phase, "breach");
  assertEquals(at(4)?.phase, "flight");
  assertEquals(at(TOTAL), null);
});

Deno.test("deep is dim and under, flight is bright and over", () => {
  const deep = at(1)!, flight = at(5)!;
  assertAlmostEquals(deep.brightness, 0.35, 0.01);
  assertEquals(deep.layer, "under");
  assertEquals(flight.brightness, 1);
  assertEquals(flight.layer, "over");
});

Deno.test("width grows", () => {
  const widths = [0, 1.5, 3, 4, 6.5].map((t) => at(t)!.widthCells);
  for (let i = 1; i < widths.length; i++) assert(widths[i] > widths[i - 1], `widths ${widths}`);
  assertAlmostEquals(widths[0], 25, 0.5);
  assert(at(6.55)!.widthCells >= 110);
});

Deno.test("ends off the top", () => {
  const f = at(TOTAL - 0.01)!;
  assert(f.y + (f.widthCells * view.cw * aspect) / 2 < 0, `bottom edge at ${f.y + (f.widthCells * view.cw * aspect) / 2}`);
});

Deno.test("gaps", () => {
  assertEquals(nextGap(() => 0, true), 8);
  assertEquals(nextGap(() => 1, true), 12);
  assertEquals(nextGap(() => 0, false), 25);
  assertEquals(nextGap(() => 1, false), 45);
});
