/**
 * Kyogre's appearance: circle A forms, it surfaces, leaps to circle B, dives in,
 * stays a while under the water, then sinks out of sight as B closes.
 */
import { type Circle, discRadius, type Foam, GAP_CELLS, type Scene, type Sprite } from "./scene.ts";

const GATHER = 3, SURFACE = 0.6, LEAP = 1.6, STAY = 2.5, DEEP = 1.5;
export const LEAP_TOTAL = GATHER + SURFACE + LEAP + STAY + DEEP;
const FOAM_SECONDS = 2;
const SIZE = 0.75;

type Point = { x: number; y: number };
const easeInOut = (k: number) => 0.5 - 0.5 * Math.cos(Math.PI * k);
const easeOut = (k: number) => 1 - (1 - k) ** 3;
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));

export function leapAt(t: number, a: Point, b: Point, view: { w: number; h: number; cw: number }, _aspect: number): Scene | null {
  if (t < 0 || t >= LEAP_TOTAL) return null;
  const R = SIZE * discRadius(view.cw);
  const surfaceAt = GATHER, leapAt = surfaceAt + SURFACE, stayAt = leapAt + LEAP, deepAt = stayAt + STAY;
  // A normal jump seen from the side of the pool: upright, only ever facing left or right.
  const face = b.x >= a.x ? 0 : Math.PI;

  // Circle A forms, holds while Kyogre surfaces, and closes behind the leap.
  const circles: Circle[] = [];
  if (t < leapAt) {
    const k = clamp01(t / GATHER);
    circles.push({ ...a, r: R * (0.03 + 0.97 * easeInOut(k)), tint: 0.2 + 0.8 * k });
  } else if (t < stayAt) {
    const k = (t - leapAt) / LEAP;
    circles.push({ ...a, r: R * (1 - easeInOut(k)), tint: 1 - k });
  }
  // Circle B opens from the surfacing so it is ready at landing, and closes over the descent.
  if (t >= surfaceAt) {
    const open = clamp01((t - surfaceAt) / (stayAt - surfaceAt));
    const close = clamp01((t - deepAt) / DEEP);
    const r = t < deepAt ? R * easeInOut(open) : R * (1 - easeInOut(close));
    circles.push({ ...b, r, tint: t < deepAt ? 0.2 + 0.8 * open : 1 - close });
  }

  const foams: Foam[] = [];
  if (t >= surfaceAt && t < surfaceAt + FOAM_SECONDS) foams.push({ ...a, progress: (t - surfaceAt) / FOAM_SECONDS, reach: R * 2 });
  if (t >= stayAt && t < stayAt + FOAM_SECONDS) foams.push({ ...b, progress: (t - stayAt) / FOAM_SECONDS, reach: R * 2 });

  let sprite: Sprite | null = null;
  let phase = "gather";
  if (t >= surfaceAt && t < leapAt) {
    phase = "surface";
    const k = easeOut((t - surfaceAt) / SURFACE);
    sprite = { pose: "breach", ...a, widthCells: 30 + 10 * k, brightness: 0.6 + 0.4 * k, squash: 1, angle: face, layer: "over" };
  } else if (t >= leapAt && t < stayAt) {
    phase = "leap";
    const k = (t - leapAt) / LEAP;
    // A gentle arc, and it swells as it rises toward the camera, then shrinks nosing down.
    const arc = Math.sin(Math.PI * k) * 0.06 * Math.hypot(b.x - a.x, b.y - a.y);
    sprite = {
      pose: "main",
      // The arc always lifts up the screen, like a jump.
      x: a.x + (b.x - a.x) * k,
      y: a.y + (b.y - a.y) * k - arc,
      widthCells: 40 + 16 * Math.sin(Math.PI * k) - 6 * k,
      brightness: k < 2 / 3 ? 1 : 1 - 1.5 * (k - 2 / 3),
      squash: 1, angle: face, layer: "over",
    };
  } else if (t >= stayAt && t < deepAt) {
    phase = "stay";
    sprite = { pose: "main", ...b, widthCells: 34, brightness: 0.35, squash: 1, angle: face, layer: "under" };
  } else if (t >= deepAt) {
    phase = "deep";
    const k = (t - deepAt) / DEEP;
    sprite = { pose: "main", ...b, widthCells: 34 - 28 * easeInOut(k), brightness: 0.35 * (1 - k), squash: 1, angle: face, layer: "under" };
  }

  // Keep the water empty around Kyogre while it is in the air.
  const path = sprite && sprite.layer === "over" ? [{ x: sprite.x, y: sprite.y, r: (sprite.widthCells * view.cw) / 2 + GAP_CELLS * view.cw }] : [];
  return { phase, circles, foams, sprite, serpent: null, path };
}

/** Where Kyogre lands: about 0.4 of the width toward the side with more room, a little up or down. */
export function leapTarget(a: Point, view: { w: number; h: number; cw: number }, rand: () => number): Point {
  const R = SIZE * discRadius(view.cw);
  const dir = a.x < view.w / 2 ? 1 : -1;
  const pad = (span: number) => Math.min(R, span / 2);
  const x = Math.min(view.w - pad(view.w), Math.max(pad(view.w), a.x + dir * 0.4 * view.w));
  const y = Math.min(view.h - pad(view.h), Math.max(pad(view.h), a.y + (rand() - 0.5) * 0.2 * view.h));
  return { x, y };
}
