import { assert, assertEquals } from "jsr:@std/assert@1.0.8";
import { Scheduler } from "./scheduler.ts";
import { TOTAL } from "./timeline.ts";

const run = { paused: false, reduced: false };

Deno.test("the first appearance waits while the hero is off-screen", () => {
  const s = new Scheduler(() => 0); // first gap = 8 s
  assertEquals(s.update(20, { paused: true, reduced: false }), null);
  assertEquals(s.update(7.9, run), null);
  assert(s.update(0.2, run) !== null, "should start once 8 s have run on-screen");
});

Deno.test("a running appearance holds still while paused", () => {
  const s = new Scheduler(() => 0);
  s.summon(false);
  s.update(1, run);
  assertEquals(s.update(5, { paused: true, reduced: false }), 1);
  assertEquals(s.update(0.5, run), 1.5);
});

Deno.test("reduced motion cancels a running appearance and frees Summon", () => {
  const s = new Scheduler(() => 0);
  s.summon(false);
  s.update(1, run);
  assertEquals(s.update(0.1, { paused: false, reduced: true }), null);
  assertEquals(s.busy(), false);
});

Deno.test("summon is ignored while busy or under reduced motion", () => {
  const s = new Scheduler(() => 0);
  assertEquals(s.summon(true), false);
  assertEquals(s.summon(false), true);
  s.update(1, run);
  assertEquals(s.summon(false), false);
  assertEquals(s.update(0.1, run), 1.1);
});

Deno.test("after an appearance ends the next gap is 25-45 s", () => {
  const s = new Scheduler(() => 0);
  s.summon(false);
  s.update(TOTAL + 0.1, run);
  s.finish();
  assertEquals(s.busy(), false);
  assertEquals(s.update(24.9, run), null);
  assert(s.update(0.2, run) !== null);
});
