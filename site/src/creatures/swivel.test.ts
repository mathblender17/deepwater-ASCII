import { assert, assertAlmostEquals, assertEquals } from "jsr:@std/assert@1.0.8";
import { bodyLengthU, NODES, pathPoint, SWIVEL_TOTAL, swivelAt } from "./swivel.ts";
import { discRadius } from "./scene.ts";

const view = { w: 1440, h: 900, cw: 12 };
const a = { x: 290, y: 600 }, b = { x: 1050, y: 250 };
const at = (t: number) => swivelAt(t, a, b, view);
const GATHER = 2.5, SWIM = 4.8;
const L = bodyLengthU(a, b, view.cw);
/** Time at which the head is at path parameter u. */
const tAt = (u: number) => GATHER + (SWIM * u) / (1 + L);
const R = 0.45 * discRadius(view.cw);
const circleAt = (t: number, p: { x: number; y: number }) => at(t)!.circles.find((c) => c.x === p.x && c.y === p.y);

Deno.test("phases run in order", () => {
  assertEquals(at(1)!.phase, "gather");
  assertEquals(at(GATHER + 1)!.phase, "swim");
  assertEquals(at(GATHER + SWIM + 0.5)!.phase, "dive");
  assertEquals(at(SWIVEL_TOTAL), null);
  assertAlmostEquals(SWIVEL_TOTAL, 8.5, 1e-9);
});

Deno.test("gyarados is hidden while circle A forms", () => {
  assertEquals(at(1)!.serpent, null);
});

Deno.test("only the stretch between the two circles is above water", () => {
  for (let t = GATHER; t < GATHER + SWIM; t += 0.2) {
    for (const n of at(t)!.serpent?.nodes ?? []) assert(n.u >= 0 && n.u <= 1, `node at u=${n.u} at ${t.toFixed(1)}s`);
  }
});

Deno.test("the body is evenly spaced", () => {
  const nodes = at(tAt(0.6))!.serpent!.nodes;
  assert(nodes.length > NODES / 2);
  const gaps = nodes.slice(1).map((n, i) => Math.hypot(n.x - nodes[i].x, n.y - nodes[i].y));
  const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  for (const g of gaps) assert(Math.abs(g - mean) <= 0.15 * mean, `gap ${g.toFixed(1)} vs mean ${mean.toFixed(1)}`);
});

Deno.test("the head leads", () => {
  const s = at(tAt(0.5))!.serpent!;
  assert(s.headVisible);
  const [h, n1] = s.nodes;
  const dot = (h.x - n1.x) * Math.cos(s.angle) + (h.y - n1.y) * Math.sin(s.angle);
  assert(dot > 0, "head should be ahead of the next node along its heading");
});

Deno.test("after the tail goes in, nothing is above water", () => {
  assertEquals(at(GATHER + SWIM + 0.1)!.serpent, null);
});

Deno.test("circle B is open when the head arrives and A closes after the tail leaves", () => {
  assertAlmostEquals(circleAt(tAt(1), b)!.r, R, 1);
  const tailLeft = tAt(L);
  assert(!circleAt(tailLeft + 1.05, a) || circleAt(tailLeft + 1.05, a)!.r < 1);
});

Deno.test("circle B closes after the dive", () => {
  const c = circleAt(SWIVEL_TOTAL - 0.01, b);
  assert(!c || c.r < R * 0.05);
});

Deno.test("the path bends into an S", () => {
  // Points at u = 0.25 and 0.75 sit on opposite sides of the straight line.
  const side = (p: { x: number; y: number }) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  assert(side(pathPoint(0.25, a, b)) * side(pathPoint(0.75, a, b)) < 0);
});
