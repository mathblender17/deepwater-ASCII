import { assert, assertAlmostEquals, assertEquals } from "jsr:@std/assert@1.0.8";
import { BREACH, CLEAR, clearZones, DEEP, FLIGHT, frameAt, nextGap, SETTLE, TOTAL } from "./timeline.ts";

const start = { x: 720, y: 450 };
const view = { w: 1440, h: 900, cw: 12 };
const aspect = 0.77;
const at = (t: number) => frameAt(t, start, view, aspect);
const RISE = CLEAR, BREACH_AT = CLEAR + DEEP, FLY_AT = BREACH_AT + BREACH, SETTLE_AT = FLY_AT + FLIGHT;

Deno.test("phases run in order", () => {
  assertEquals(at(0.5)?.phase, "clear");
  assertEquals(at(RISE + 1)?.phase, "deep");
  assertEquals(at(BREACH_AT + 0.2)?.phase, "breach");
  assertEquals(at(FLY_AT + 0.5)?.phase, "flight");
  assertEquals(at(SETTLE_AT + 0.5)?.phase, "settle");
  assertEquals(at(TOTAL), null);
  assertAlmostEquals(TOTAL, CLEAR + DEEP + BREACH + FLIGHT + SETTLE, 1e-9);
});

Deno.test("lugia is hidden while the water clears and settles", () => {
  assertEquals(at(0.5)!.layer, null);
  assertEquals(at(SETTLE_AT + 0.5)!.layer, null);
});

Deno.test("deep is dim and under, flight is bright and over", () => {
  const deep = at(RISE + 1)!, flight = at(FLY_AT + 1)!;
  assertAlmostEquals(deep.brightness, 0.35, 0.01);
  assertEquals(deep.layer, "under");
  assertEquals(flight.brightness, 1);
  assertEquals(flight.layer, "over");
});

Deno.test("grows from a speck to past the screen", () => {
  const ts = [RISE, RISE + 1.5, BREACH_AT, FLY_AT, FLY_AT + 1.5, SETTLE_AT - 0.05];
  const widths = ts.map((t) => at(t)!.widthCells);
  for (let i = 1; i < widths.length; i++) assert(widths[i] > widths[i - 1], `widths ${widths}`);
  assert(widths[0] <= 5, `starts at ${widths[0]} cells`);
  assert(widths[widths.length - 1] >= 110, `ends at ${widths[widths.length - 1]} cells`);
});

Deno.test("ends off the top", () => {
  const f = at(SETTLE_AT - 0.01)!;
  assert(f.y + (f.widthCells * view.cw * aspect) / 2 < 0, `bottom edge at ${f.y + (f.widthCells * view.cw * aspect) / 2}`);
});

Deno.test("grows toward the camera before leaving", () => {
  const f = at(FLY_AT + FLIGHT * 0.6)!;
  assert(f.y > view.h * 0.15, `centre already at ${f.y}`);
  assert(f.widthCells > 70, `width ${f.widthCells}`);
});

Deno.test("the clear zone opens first and closes last", () => {
  assertAlmostEquals(at(0)!.zone, 0, 0.01);
  assertAlmostEquals(at(CLEAR)!.zone, 1, 0.01);
  assertEquals(at(FLY_AT + 1)!.zone, 1);
  assert(at(TOTAL - 0.01)!.zone < 0.05);
});

Deno.test("the water darkens as lugia rises and recovers after", () => {
  assert(at(RISE + 0.2)!.tint < at(BREACH_AT - 0.1)!.tint);
  assertAlmostEquals(at(BREACH_AT)!.tint, 1, 0.01);
  assert(at(TOTAL - 0.01)!.tint < 0.05);
});

Deno.test("the breach ring runs from the breach for two seconds", () => {
  assertEquals(at(BREACH_AT - 0.1)!.ring, null);
  assertAlmostEquals(at(BREACH_AT)!.ring!, 0, 0.01);
  assertAlmostEquals(at(BREACH_AT + 1)!.ring!, 0.5, 0.01);
  assertEquals(at(BREACH_AT + 2.1)!.ring, null);
});

Deno.test("clear zones: a disc, plus the path to the top during flight", () => {
  const cw = view.cw;
  assertEquals(clearZones(at(0)!, cw).length, 0);
  const opening = clearZones(at(CLEAR / 2)!, cw);
  assertEquals(opening.length, 1);
  assertAlmostEquals(opening[0].r, 0.5 * 1.5 * (45 * cw) / 2, 1);
  const flight = at(FLY_AT + 1)!;
  const zones = clearZones(flight, cw);
  assert(zones.length > 1);
  // Every point straight above Lugia, up to the top edge, is inside some zone.
  for (let y = flight.y; y >= 0; y -= 20) {
    assert(zones.some((z) => Math.hypot(flight.x - z.x, y - z.y) <= z.r), `gap in the path at y=${y}`);
  }
});

Deno.test("gaps", () => {
  assertEquals(nextGap(() => 0, true), 8);
  assertEquals(nextGap(() => 1, true), 12);
  assertEquals(nextGap(() => 0, false), 25);
  assertEquals(nextGap(() => 1, false), 45);
});
