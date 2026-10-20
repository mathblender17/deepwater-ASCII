/** When appearances happen: one at a time, only while the ocean is visible, never under reduced motion. */
import { nextGap } from "./timeline.ts";

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
