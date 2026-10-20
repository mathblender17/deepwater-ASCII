import { assert, assertAlmostEquals, assertEquals } from "jsr:@std/assert@1.0.8";
import { BREACH, FLIGHT, GATHER, riseAt, SETTLE, TOTAL } from "./rise.ts";
import { clearZones, discRadius, GAP_CELLS, type Scene } from "./scene.ts";
import { nextGap } from "./scheduler.ts";

const start = { x: 720, y: 450 };
const view = { w: 1440, h: 900, cw: 12 };
const aspect = 0.77;
const at = (t: number) => {
  const s = riseAt(t, start, view, aspect);
  if (!s) return null;
  // Read the scene the way the old frame was read, so the approved Lugia tests stay word for word.
  const c = s.circles[0];
  return {
    ...s, layer: s.sprite?.layer ?? null, widthCells: s.sprite?.widthCells ?? 0, brightness: s.sprite?.brightness ?? 0,
    x: s.sprite?.x ?? start.x, y: s.sprite?.y ?? start.y, zone: c ? c.r / discRadius(view.cw) : 0, tint: c?.tint ?? 0,
    ring: s.foams[0]?.progress ?? null, scene: s as Scene,
  };
};
const BREACH_AT = GATHER, FLY_AT = GATHER + BREACH, SETTLE_AT = FLY_AT + FLIGHT;

Deno.test("phases run in order", () => {
  assertEquals(at(0.5)?.phase, "gather");
  assertEquals(at(BREACH_AT + 0.2)?.phase, "breach");
  assertEquals(at(FLY_AT + 0.5)?.phase, "flight");
  assertEquals(at(SETTLE_AT + 0.5)?.phase, "settle");
  assertEquals(at(TOTAL), null);
  assertAlmostEquals(TOTAL, GATHER + BREACH + FLIGHT + SETTLE, 1e-9);
});

Deno.test("lugia stays hidden while the circle forms and while the water settles", () => {
  for (const t of [0, 1, 2, 3, BREACH_AT - 0.01]) assertEquals(at(t)!.layer, null, `visible at ${t}s`);
  assertEquals(at(SETTLE_AT + 0.5)!.layer, null);
});

Deno.test("the circle grows from a dot to full size, then lugia emerges", () => {
  const zones = [0, 0.8, 1.6, 2.4, BREACH_AT - 0.01].map((t) => at(t)!.zone);
  assert(zones[0] <= 0.05, `starts at ${zones[0]}`);
  for (let i = 1; i < zones.length; i++) assert(zones[i] > zones[i - 1], `zones ${zones}`);
  assertAlmostEquals(at(BREACH_AT)!.zone, 1, 0.01);
  assertEquals(at(BREACH_AT)!.layer, "over");
});

Deno.test("lugia emerges at a modest size and swells in brightness", () => {
  const pop = at(BREACH_AT)!;
  assert(pop.widthCells >= 30 && pop.widthCells <= 40, `pops at ${pop.widthCells} cells`);
  assert(pop.brightness < 1);
  assertEquals(at(FLY_AT)!.brightness, 1);
});

Deno.test("grows past the screen after emerging", () => {
  const widths = [BREACH_AT, BREACH_AT + 0.3, FLY_AT, FLY_AT + 1.5, SETTLE_AT - 0.05].map((t) => at(t)!.widthCells);
  for (let i = 1; i < widths.length; i++) assert(widths[i] > widths[i - 1], `widths ${widths}`);
  assert(widths[widths.length - 1] >= 110);
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

Deno.test("the water darkens as the circle forms and recovers after", () => {
  assert(at(0.3)!.tint < at(BREACH_AT - 0.1)!.tint);
  assertAlmostEquals(at(BREACH_AT)!.tint, 1, 0.01);
  assert(at(TOTAL - 0.01)!.tint < 0.05);
});

Deno.test("the foam ring runs from the breach for two seconds", () => {
  assertEquals(at(BREACH_AT - 0.1)!.ring, null);
  assertAlmostEquals(at(BREACH_AT)!.ring!, 0, 0.01);
  assertAlmostEquals(at(BREACH_AT + 1)!.ring!, 0.5, 0.01);
  assertEquals(at(BREACH_AT + 2.1)!.ring, null);
});

Deno.test("the clear zone is the circle plus an empty gap, growing with it", () => {
  const cw = view.cw;
  const mid = at(GATHER / 2)!;
  const [disc] = clearZones(mid.scene, cw);
  assertAlmostEquals(disc.r, mid.zone * discRadius(cw) + GAP_CELLS * cw, 1);
  assert(clearZones(at(0.2)!.scene, cw)[0].r < clearZones(at(GATHER - 0.1)!.scene, cw)[0].r);
});

Deno.test("lugia's path to the top stays clear in flight", () => {
  const flight = at(FLY_AT + 1)!;
  const zones = clearZones(flight.scene, view.cw);
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

Deno.test("clearZones returns each open circle plus the gap, then the path", () => {
  const scene: Scene = {
    phase: "x", foams: [], sprite: null, serpent: null,
    circles: [{ x: 10, y: 20, r: 100, tint: 1 }, { x: 0, y: 0, r: 0, tint: 0 }],
    path: [{ x: 5, y: 5, r: 7 }],
  };
  assertEquals(clearZones(scene, 12), [{ x: 10, y: 20, r: 100 + GAP_CELLS * 12 }, { x: 5, y: 5, r: 7 }]);
});
