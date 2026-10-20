/**
 * One legendary appearance: a circle forms on the water and widens from a dot,
 * Lugia emerges from it with a splash, flies up past the camera, and the water settles.
 */
export const GATHER = 3.5, BREACH = 0.6, FLIGHT = 3, SETTLE = 1;
export const TOTAL = GATHER + BREACH + FLIGHT + SETTLE;
/** Empty band kept between the circle and everything else, in cells. */
export const GAP_CELLS = 6;
const RING_SECONDS = 2;

/** Radius of the fully formed circle, px (about 67 cells across). */
export const discRadius = (cw: number) => 1.5 * (45 * cw) / 2;

export type Frame = {
  phase: "gather" | "breach" | "flight" | "settle";
  /** Centre of the sprite, px. */
  x: number;
  y: number;
  /** Centre of the circle on the water, px. */
  cx: number;
  cy: number;
  widthCells: number;
  brightness: number;
  /** Vertical scale for the wing beat, 0.92–1. */
  squash: number;
  /** null while Lugia itself is not drawn. */
  layer: "under" | "over" | null;
  /** 0–1: the circle's radius as a share of discRadius. */
  zone: number;
  /** 0–1: how strongly the water inside is tinted. */
  tint: number;
  /** 0–1 progress of the foam ring after the breach, or null. */
  ring: number | null;
};

const beat = (t: number, hz: number) => 0.92 + 0.08 * (0.5 + 0.5 * Math.cos(2 * Math.PI * hz * t));
const easeInOut = (k: number) => 0.5 - 0.5 * Math.cos(Math.PI * k);
const easeOut = (k: number) => 1 - (1 - k) ** 3;

/** `aspect` is the mask's height / width. Returns null once the appearance is over. */
export function frameAt(t: number, start: { x: number; y: number }, view: { w: number; h: number; cw: number }, aspect: number): Frame | null {
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

/** Areas fish and sharks are pushed out of: the circle plus an empty gap, and Lugia's path to the top in flight. */
export function clearZones(f: Frame, cw: number): { x: number; y: number; r: number }[] {
  if (f.zone <= 0) return [];
  const zones = [{ x: f.cx, y: f.cy, r: f.zone * discRadius(cw) + GAP_CELLS * cw }];
  if (f.phase === "flight") {
    const r = (f.widthCells * cw) / 2 * 0.9;
    for (let y = f.y; y > -r; y -= r) zones.push({ x: f.x, y, r });
  }
  return zones;
}

/** Seconds until the next appearance: the first comes quickly, later ones are rarer. */
export function nextGap(rand: () => number, first: boolean): number {
  return first ? 8 + 4 * rand() : 25 + 20 * rand();
}
