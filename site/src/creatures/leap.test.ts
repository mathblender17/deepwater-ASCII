import { assert, assertAlmostEquals, assertEquals } from "jsr:@std/assert@1.0.8";
import { LEAP_TOTAL, leapAt, leapTarget } from "./leap.ts";
import { discRadius } from "./scene.ts";

const view = { w: 1440, h: 900, cw: 12 };
const a = { x: 500, y: 450 }, b = { x: 1076, y: 420 };
const at = (t: number) => leapAt(t, a, b, view, 0.6);
const R = 0.75 * discRadius(view.cw);
const SURFACE = 3, LEAP = 3.6, STAY = 5.2, DEEP = 7.7;
const circleAt = (t: number, p: { x: number; y: number }) => at(t)!.circles.find((c) => c.x === p.x && c.y === p.y);

Deno.test("phases run in order", () => {
  assertEquals(at(1)!.phase, "gather");
  assertEquals(at(SURFACE + 0.3)!.phase, "surface");
  assertEquals(at(LEAP + 0.8)!.phase, "leap");
  assertEquals(at(STAY + 1)!.phase, "stay");
  assertEquals(at(DEEP + 1)!.phase, "deep");
  assertEquals(at(LEAP_TOTAL), null);
  assertAlmostEquals(LEAP_TOTAL, 9.2, 1e-9);
});

Deno.test("kyogre is hidden while circle A forms", () => {
  assertEquals(at(1)!.sprite, null);
  assertEquals(at(SURFACE - 0.01)!.sprite, null);
});

Deno.test("it surfaces over the water and jumps upright, facing left or right only", () => {
  assertEquals(at(SURFACE + 0.1)!.sprite!.layer, "over");
  assertEquals(at(SURFACE + 0.1)!.sprite!.pose, "breach");
  // A normal jump: never rolled or tilted, whatever the travel direction.
  for (const t of [SURFACE + 0.1, LEAP + 0.8, STAY + 1, DEEP + 1]) assertEquals(at(t)!.sprite!.angle, 0, `tilted at ${t}s`);
  const left = leapAt(LEAP + 0.8, b, a, view, 0.6)!.sprite!;
  assertEquals(left.angle, Math.PI);
});

Deno.test("width peaks mid-leap", () => {
  const start = at(LEAP)!.sprite!.widthCells, mid = at(LEAP + 0.8)!.sprite!.widthCells, end = at(STAY - 0.01)!.sprite!.widthCells;
  assert(mid > start && mid > end, `${start} ${mid} ${end}`);
  assert(mid >= 1.3 * start);
});

Deno.test("circle B is fully open at landing and A has closed", () => {
  assertAlmostEquals(circleAt(STAY, b)!.r, R, 1);
  assert(!circleAt(STAY, a) || circleAt(STAY, a)!.r < 1);
});

Deno.test("under the water it stays dim, then sinks as B closes", () => {
  const stay = at(STAY + 1)!.sprite!;
  assertEquals(stay.layer, "under");
  assertAlmostEquals(stay.brightness, 0.35, 0.01);
  const late = at(LEAP_TOTAL - 0.01)!;
  assert(late.sprite!.widthCells < 10);
  assert(!circleAt(LEAP_TOTAL - 0.01, b) || circleAt(LEAP_TOTAL - 0.01, b)!.r < R * 0.05);
});

Deno.test("foam bursts at A on surfacing and at B on the dive", () => {
  assert(at(SURFACE + 0.2)!.foams.some((f) => f.x === a.x && f.y === a.y));
  assert(at(STAY + 0.2)!.foams.some((f) => f.x === b.x && f.y === b.y));
});

Deno.test("leapTarget keeps the landing inside the view from either edge", () => {
  for (const x of [0.1, 0.5, 0.9]) {
    for (const r of [0, 0.5, 1]) {
      const t = leapTarget({ x: view.w * x, y: view.h / 2 }, view, () => r);
      assert(t.x >= 0 && t.x <= view.w && t.y >= 0 && t.y <= view.h, `landing ${t.x},${t.y} from x=${x}`);
      assert(Math.abs(t.x - view.w * x) > view.w * 0.2, `too short a leap from x=${x}`);
    }
  }
});
