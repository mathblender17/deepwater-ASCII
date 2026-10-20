/**
 * Gyarados's appearance: circle A forms, it bursts out and swivels along an S-curve
 * with its body following, then dives into circle B, which closes after its tail.
 */
import { type Circle, discRadius, type Foam, type Scene, type SerpentNode } from "./scene.ts";

const GATHER = 2.5, SWIM = 4.8, DIVE = 1.2;
export const SWIVEL_TOTAL = GATHER + SWIM + DIVE;
export const NODES = 24;
const BODY_CELLS = 70;
const WIDTH_CELLS = 9;
const SIZE = 0.45;
const A_CLOSE = 1;
const FOAM_SECONDS = 2;

type Point = { x: number; y: number };
const easeInOut = (k: number) => 0.5 - 0.5 * Math.cos(Math.PI * k);
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));

/** The S-curve from a to b at raw parameter u (0–1). */
export function pathPoint(u: number, a: Point, b: Point): Point {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const off = Math.sin(2 * Math.PI * u) * 0.18 * len;
  return { x: a.x + dx * u - (dy / len) * off, y: a.y + dy * u + (dx / len) * off };
}

/** Cumulative arc length table, so body points can be spaced evenly along the curve. */
function arcTable(a: Point, b: Point, n = 160) {
  const len = [0];
  let prev = pathPoint(0, a, b);
  for (let i = 1; i <= n; i++) {
    const p = pathPoint(i / n, a, b);
    len.push(len[i - 1] + Math.hypot(p.x - prev.x, p.y - prev.y));
    prev = p;
  }
  return len;
}

/** Point at arc fraction s (0–1) of the curve. */
function atArc(s: number, a: Point, b: Point, table: number[]): Point {
  const n = table.length - 1, target = s * table[n];
  let i = 1;
  while (i < n && table[i] < target) i++;
  const k = (target - table[i - 1]) / ((table[i] - table[i - 1]) || 1);
  return pathPoint((i - 1 + k) / n, a, b);
}

/** Body length as a share of the curve's length. */
export function bodyLengthU(a: Point, b: Point, cw: number) {
  const t = arcTable(a, b);
  return (BODY_CELLS * cw) / t[t.length - 1];
}

export function swivelAt(t: number, a: Point, b: Point, view: { w: number; h: number; cw: number }): Scene | null {
  if (t < 0 || t >= SWIVEL_TOTAL) return null;
  const R = SIZE * discRadius(view.cw);
  const table = arcTable(a, b);
  const L = (BODY_CELLS * view.cw) / table[table.length - 1];
  const head = t < GATHER ? 0 : Math.min(1 + L, ((t - GATHER) / SWIM) * (1 + L));
  const tTailLeavesA = GATHER + (SWIM * L) / (1 + L);
  const tHeadReachesB = GATHER + SWIM / (1 + L);
  const diveAt = GATHER + SWIM;

  const circles: Circle[] = [];
  if (t < GATHER) {
    const k = t / GATHER;
    circles.push({ ...a, r: R * (0.03 + 0.97 * easeInOut(k)), tint: 0.2 + 0.8 * k });
  } else {
    const close = clamp01((t - tTailLeavesA) / A_CLOSE);
    if (close < 1) circles.push({ ...a, r: R * (1 - easeInOut(close)), tint: 1 - close });
  }
  // B opens as the head passes halfway, fully open on arrival, and closes once the tail is in.
  const open = clamp01((head - 0.5) / 0.5);
  if (open > 0) {
    const close = clamp01((t - diveAt) / DIVE);
    circles.push({ ...b, r: R * easeInOut(open) * (1 - easeInOut(close)), tint: (0.2 + 0.8 * open) * (1 - close) });
  }

  const foams: Foam[] = [];
  if (t >= GATHER && t < GATHER + FOAM_SECONDS) foams.push({ ...a, progress: (t - GATHER) / FOAM_SECONDS, reach: R * 2 });
  if (t >= tHeadReachesB && t < tHeadReachesB + FOAM_SECONDS) foams.push({ ...b, progress: (t - tHeadReachesB) / FOAM_SECONDS, reach: R * 2 });

  let phase = "gather";
  let serpent: Scene["serpent"] = null;
  const path: Scene["path"] = [];
  if (t >= GATHER && t < diveAt) {
    phase = "swim";
    const nodes: SerpentNode[] = [];
    for (let k = 0; k < NODES; k++) {
      const u = head - (k * L) / (NODES - 1);
      if (u < 0 || u > 1) continue;
      nodes.push({ ...atArc(u, a, b, table), k, u });
    }
    if (nodes.length) {
      const front = Math.min(1, Math.max(0, nodes[0].u));
      const p0 = atArc(Math.max(0, front - 0.01), a, b, table), p1 = atArc(Math.min(1, front + 0.01), a, b, table);
      serpent = { nodes, angle: Math.atan2(p1.y - p0.y, p1.x - p0.x), widthCells: WIDTH_CELLS, brightness: 1, headVisible: nodes[0].k === 0 };
      for (const n of nodes) path.push({ x: n.x, y: n.y, r: WIDTH_CELLS * view.cw });
    }
  } else if (t >= diveAt) {
    phase = "dive";
  }
  return { phase, circles, foams, sprite: null, serpent, path };
}
