/**
 * One legendary appearance: the water clears, Lugia rises from a speck in the deep,
 * breaches, flies up past the camera, and the water settles back.
 */
export const CLEAR = 1.2, DEEP = 3, BREACH = 0.8, FLIGHT = 3, SETTLE = 1;
export const TOTAL = CLEAR + DEEP + BREACH + FLIGHT + SETTLE;
/** Underwater width at the breach, in cells; the clear zone is sized from it. */
const SURFACE_CELLS = 45;
const RING_SECONDS = 2;

export type Frame = {
  phase: "clear" | "deep" | "breach" | "flight" | "settle";
  /** Centre of the sprite, px. */
  x: number;
  y: number;
  /** Where it rises from, px: the centre of the cleared water. */
  cx: number;
  cy: number;
  widthCells: number;
  brightness: number;
  /** Vertical scale for the wing beat, 0.92–1. */
  squash: number;
  /** null while Lugia itself is not drawn. */
  layer: "under" | "over" | null;
  /** 0–1: how far the clear zone has opened. */
  zone: number;
  /** 0–1: how strongly the water is recoloured. */
  tint: number;
  /** 0–1 progress of the breach ring, or null when there is none. */
  ring: number | null;
};

const beat = (t: number, hz: number) => 0.92 + 0.08 * (0.5 + 0.5 * Math.cos(2 * Math.PI * hz * t));

/** `aspect` is the mask's height / width. Returns null once the appearance is over. */
export function frameAt(t: number, start: { x: number; y: number }, view: { w: number; h: number; cw: number }, aspect: number): Frame | null {
  if (t < 0 || t >= TOTAL) return null;
  const breachAt = CLEAR + DEEP, flyAt = breachAt + BREACH, settleAt = flyAt + FLIGHT;
  const drift = 1.5 * view.cw * Math.sin(t * 0.7);
  const ring = t >= breachAt && t < breachAt + RING_SECONDS ? (t - breachAt) / RING_SECONDS : null;
  const base = { cx: start.x, cy: start.y, ring, x: start.x + drift, y: start.y };
  const endY = -(125 * view.cw * aspect) / 2 - view.h * 0.05;

  if (t < CLEAR) {
    const k = t / CLEAR;
    return { ...base, phase: "clear", widthCells: 4, brightness: 0.35, squash: 1, layer: null, zone: k, tint: 0.25 * k };
  }
  if (t < breachAt) {
    const k = (t - CLEAR) / DEEP;
    return {
      ...base, phase: "deep", widthCells: 4 + (SURFACE_CELLS - 4) * k ** 1.6, brightness: 0.35,
      squash: beat(t, 0.6), layer: "under", zone: 1, tint: 0.25 + 0.75 * k,
    };
  }
  if (t < flyAt) {
    const k = (t - breachAt) / BREACH;
    return {
      ...base, phase: "breach", widthCells: SURFACE_CELLS + 2 * k, brightness: 0.35 + 0.65 * k,
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

/** Areas fish and sharks are pushed out of: the cleared disc, plus Lugia's path to the top while it flies. */
export function clearZones(f: Frame, cw: number): { x: number; y: number; r: number }[] {
  if (f.zone <= 0) return [];
  const zones = [{ x: f.cx, y: f.cy, r: f.zone * 1.5 * (SURFACE_CELLS * cw) / 2 }];
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
