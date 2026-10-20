/**
 * Loads creatures from the local Pokémon pack and schedules their appearances.
 * The pack is git-ignored: without it this does nothing and the ocean runs as before.
 */
import type { Grid, Layer } from "../../../vendor-ascii-sharks/src/renderer.ts";
import { type Colors, drawCreature } from "./draw.ts";
import { buildMask, type Mask } from "./mask.ts";
import { type Frame, frameAt, nextGap } from "./timeline.ts";

type Ocean = {
  canvas: HTMLCanvasElement;
  addLayer(layer: Layer): void;
  setRepel(r: { x: number; y: number; r: number } | null): void;
  splash(x: number, y: number): void;
};
type Entry = { pose: string; breach?: string; colors: Colors };

async function loadMask(url: string): Promise<Mask> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const cv = document.createElement("canvas");
  cv.width = img.naturalWidth;
  cv.height = img.naturalHeight;
  const g = cv.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(img, 0, 0);
  // Throws on file:// (tainted canvas); the caller turns that into one console note.
  const data = g.getImageData(0, 0, cv.width, cv.height).data;
  return buildMask(data, cv.width, cv.height);
}

export async function mountCreatures(ocean: Ocean, opts: { packUrl: string; onReady(summon: () => void, busy: () => boolean): void }) {
  let lugia: Entry, pose: Mask, breach: Mask | null = null;
  try {
    const packUrl = new URL(opts.packUrl, location.href);
    const pack = await (await fetch(packUrl)).json();
    if (!pack?.lugia?.pose || !pack.lugia.colors) throw new Error("pack.json has no lugia entry");
    lugia = pack.lugia;
    pose = await loadMask(new URL(lugia.pose, packUrl).href);
    if (lugia.breach) breach = await loadMask(new URL(lugia.breach, packUrl).href).catch(() => null);
  } catch (e) {
    console.warn(location.protocol === "file:" ? "Creatures need the local server (images can't be read from file://)." : `Creatures skipped: ${(e as Error).message}`);
    return;
  }
  if (!pose.w || pose.coverage > 0.9) {
    console.warn(`Creatures skipped: ${lugia.pose} did not cut out cleanly (coverage ${pose.coverage.toFixed(2)}).`);
    return;
  }
  console.assert(pose.coverage >= 0.35 && pose.coverage <= 0.6, `Lugia cut-out coverage ${pose.coverage.toFixed(2)} is outside 0.35–0.6`);
  if (breach && (!breach.w || breach.coverage > 0.9)) breach = null;

  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let grid: Grid | null = null;
  let frame: Frame | null = null;
  let active: { t: number; start: { x: number; y: number }; splashed: boolean } | null = null;
  let countdown = nextGap(Math.random, true);

  const layer = (depth: "under" | "over"): Layer => ({
    depth,
    draw(ctx, g) {
      grid = g;
      if (!frame || frame.layer !== depth) return;
      const mask = frame.phase === "breach" && breach ? breach : pose;
      drawCreature(ctx, g, mask, frame, lugia.colors, document.documentElement.dataset.theme === "light");
    },
  });
  ocean.addLayer(layer("under"));
  ocean.addLayer(layer("over"));

  const begin = () => {
    const r = ocean.canvas.getBoundingClientRect();
    active = { t: 0, start: { x: r.width * (1 / 3 + Math.random() / 3), y: r.height * (0.4 + 0.2 * Math.random()) }, splashed: false };
  };

  let last = performance.now();
  const tick = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    requestAnimationFrame(tick);
    if (document.hidden || reduced.matches) return;
    if (!active) {
      countdown -= dt;
      if (countdown <= 0) begin();
      return;
    }
    active.t += dt;
    const r = ocean.canvas.getBoundingClientRect();
    const cw = grid?.cw ?? 12;
    const aspect = pose.h / pose.w;
    frame = frameAt(active.t, active.start, { w: r.width, h: r.height, cw }, aspect);
    if (!frame) {
      active = null;
      ocean.setRepel(null);
      countdown = nextGap(Math.random, false);
      return;
    }
    const half = (frame.widthCells * cw) / 2;
    ocean.setRepel(frame.phase === "deep" ? { x: frame.x, y: frame.y, r: half } : null);
    if (frame.phase === "breach" && !active.splashed) {
      active.splashed = true;
      ocean.splash(frame.x, frame.y);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ocean.splash(frame.x + Math.cos(a) * half, frame.y + Math.sin(a) * half * aspect);
      }
    }
  };
  requestAnimationFrame(tick);

  if (reduced.matches) return;
  opts.onReady(() => { if (!active) begin(); }, () => !!active);
}
