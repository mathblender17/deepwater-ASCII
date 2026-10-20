/** When appearances happen: one at a time, only while the ocean is visible, never under reduced motion. */

export class Scheduler {
  private t: number | null = null;
  private countdown: number;

  constructor(private rand: () => number = Math.random) {
    this.countdown = nextGap(rand, true);
  }

  /** Advance by dt seconds. Returns seconds into the running appearance, or null when none is running. */
  update(dt: number, s: { paused: boolean; reduced: boolean }): number | null {
    if (s.reduced) {
      this.t = null;
      return null;
    }
    if (s.paused) return this.t;
    if (this.t === null) {
      this.countdown -= dt;
      if (this.countdown <= 0) this.t = 0;
      return this.t;
    }
    this.t += dt;
    return this.t;
  }

  /** Start now unless one is running or motion is reduced; true if it started. */
  summon(reduced: boolean): boolean {
    if (reduced || this.t !== null) return false;
    this.t = 0;
    return true;
  }

  /** The running appearance is over; schedule the next one. */
  finish() {
    this.t = null;
    this.countdown = nextGap(this.rand, false);
  }

  busy() {
    return this.t !== null;
  }
}

/** Seconds until the next appearance: the first comes quickly, later ones are rarer. */
export function nextGap(rand: () => number, first: boolean): number {
  return first ? 8 + 4 * rand() : 25 + 20 * rand();
}

/** Who appears next: visitors share half the appearances and legendaries the other half; a missing group gives way. */
export function pickCreature(rand: () => number, loaded: { name: string; role: "legendary" | "visitor" }[]): string {
  const visitors = loaded.filter((c) => c.role === "visitor"), legends = loaded.filter((c) => c.role !== "visitor");
  const r = rand();
  const from = (list: typeof loaded, k: number) => list[Math.min(list.length - 1, Math.floor(k * list.length))].name;
  if (!visitors.length) return from(legends, r);
  if (!legends.length) return from(visitors, r);
  return r < 0.5 ? from(visitors, r / 0.5) : from(legends, (r - 0.5) / 0.5);
}
