import { discRadius, type Scene } from "./scene.ts";

/**
 * One legendary appearance: a circle forms on the water and widens from a dot,
 * Lugia emerges from it with a splash, flies up past the camera, and the water settles.
 */
export const GATHER = 3.5, BREACH = 0.6, FLIGHT = 3, SETTLE = 1;
export const TOTAL = GATHER + BREACH + FLIGHT + SETTLE;
export const RISE_TOTAL = TOTAL;
const RING_SECONDS = 2;


const beat = (t: number, hz: number) => 0.92 + 0.08 * (0.5 + 0.5 * Math.cos(2 * Math.PI * hz * t));
const easeInOut = (k: number) => 0.5 - 0.5 * Math.cos(Math.PI * k);
const easeOut = (k: number) => 1 - (1 - k) ** 3;

/** `aspect` is the mask's height / width. Returns null once the appearance is over. */
type Frame = {
  phase: "gather" | "breach" | "flight" | "settle";
  x: number; y: number; cx: number; cy: number; widthCells: number; brightness: number; squash: number;
  layer: "under" | "over" | null; zone: number; tint: number; ring: number | null;
};

/** Lugia's appearance as a scene. */
export function riseAt(t: number, start: { x: number; y: number }, view: { w: number; h: number; cw: number }, aspect: number): Scene | null {
  const f = frameAt(t, start, view, aspect);
  if (!f) return null;
  const disc = discRadius(view.cw);
  const path: Scene["path"] = [];
  if (f.phase === "flight") {
    const r = (f.widthCells * view.cw) / 2 * 0.9;
    for (let y = f.y; y > -r; y -= r) path.push({ x: f.x, y, r });
  }
  return {
    phase: f.phase,
    circles: f.zone > 0 ? [{ x: f.cx, y: f.cy, r: f.zone * disc, tint: f.tint }] : [],
    foams: f.ring === null ? [] : [{ x: f.cx, y: f.cy, progress: f.ring, reach: disc * 2.2 }],
    sprite: f.layer === null ? null : {
      pose: f.phase === "breach" ? "breach" : "main", x: f.x, y: f.y, widthCells: f.widthCells,
      brightness: f.brightness, squash: f.squash, angle: 0, layer: f.layer,
    },
    serpent: null,
    path,
  };
}

function frameAt(t: number, start: { x: number; y: number }, view: { w: number; h: number; cw: number }, aspect: number): Frame | null {
  if (t < 0 || t >= TOTAL) return null;
  const flyAt = GATHER + BREACH, settleAt = flyAt + FLIGHT;
  const drift = 1.5 * view.cw * Math.sin(t * 0.7);
  const ring = t >= GATHER && t < GATHER + RING_SECONDS ? (t - GATHER) / RING_SECONDS : null;
  const base = { cx: start.x, cy: start.y, ring, x: start.x + drift, y: start.y };
  const endY = -(125 * view.cw * aspect) / 2 - view.h * 0.05;

  if (t < GATHER) {
    const k = t / GATHER;
    return {
      ...base, phase: "gather", widthCells: 0, brightness: 0, squash: 1, layer: null,
      zone: 0.03 + 0.97 * easeInOut(k), tint: 0.2 + 0.8 * k,
    };
  }
  if (t < flyAt) {
    // Lugia emerges with a soft swell, not a jump.
    const k = easeOut((t - GATHER) / BREACH);
    return {
      ...base, phase: "breach", widthCells: 34 + 13 * k, brightness: 0.6 + 0.4 * k,
      squash: beat(t, 1.2), layer: "over", zone: 1, tint: 1,
    };
  }
  if (t < settleAt) {
    const k = (t - flyAt) / FLIGHT;
    // Grow mostly in place (toward the camera), then sweep off the top late in the flight.
    return {
      ...base, phase: "flight", widthCells: 47 + 78 * k * k, y: start.y + (endY - start.y) * k * k * k,
      brightness: 1, squash: beat(t, 2), layer: "over", zone: 1, tint: 1,
    };
  }
  const k = (t - settleAt) / SETTLE;
  return { ...base, phase: "settle", widthCells: 125, y: endY, brightness: 1, squash: 1, layer: null, zone: 1 - k, tint: 1 - k };
}
