/** One legendary appearance: deep under the water, the breach, then flight up past the camera. */
export const DEEP = 3, BREACH = 0.6, FLIGHT = 3, TOTAL = DEEP + BREACH + FLIGHT;

export type Frame = {
  phase: "deep" | "breach" | "flight";
  /** Centre of the sprite, px. */
  x: number;
  y: number;
  widthCells: number;
  brightness: number;
  /** Vertical scale for the wing beat, 0.92–1. */
  squash: number;
  layer: "under" | "over";
};

const beat = (t: number, hz: number) => 0.92 + 0.08 * (0.5 + 0.5 * Math.cos(2 * Math.PI * hz * t));

/** `aspect` is the mask's height / width. Returns null once the appearance is over. */
export function frameAt(t: number, start: { x: number; y: number }, view: { w: number; h: number; cw: number }, aspect: number): Frame | null {
  if (t < 0 || t >= TOTAL) return null;
  const drift = 1.5 * view.cw * Math.sin(t * 0.7);
  if (t < DEEP) {
    return {
      phase: "deep", x: start.x + drift, y: start.y,
      widthCells: 25 + 20 * (t / DEEP), brightness: 0.35, squash: beat(t, 0.6), layer: "under",
    };
  }
  if (t < DEEP + BREACH) {
    const k = (t - DEEP) / BREACH;
    return {
      phase: "breach", x: start.x + drift, y: start.y,
      widthCells: 45 + 2 * k, brightness: 0.35 + 0.65 * k, squash: beat(t, 1.2), layer: "over",
    };
  }
  const k = (t - DEEP - BREACH) / FLIGHT;
  const ease = k * k;
  const widthCells = 47 + 78 * ease;
  // Rise until the sprite's bottom edge clears the top of the view.
  const endY = -(125 * view.cw * aspect) / 2 - view.h * 0.05;
  return {
    phase: "flight", x: start.x + drift, y: start.y + (endY - start.y) * ease,
    widthCells, brightness: 1, squash: beat(t, 2), layer: "over",
  };
}

/** Seconds until the next appearance: the first comes quickly, later ones are rarer. */
export function nextGap(rand: () => number, first: boolean): number {
  return first ? 8 + 4 * rand() : 25 + 20 * rand();
}
