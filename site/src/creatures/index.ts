/**
 * Loads creatures from the local Pokémon pack and schedules their appearances.
 * The pack is git-ignored: without it this does nothing and the ocean runs as before.
 */
import type { Grid, Layer } from "../../../vendor-ascii-sharks/src/renderer.ts";
import { type Colors, drawCreature } from "./draw.ts";
import { buildMask, type Mask } from "./mask.ts";
import { Scheduler } from "./scheduler.ts";
import { type Frame, frameAt } from "./timeline.ts";

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
    const res = await fetch(packUrl);
    if (!res.ok) throw new Error(`no pack at ${packUrl.pathname} (${res.status})`);
    const pack = await res.json();
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
  const schedule = new Scheduler();
  let grid: Grid | null = null;
  let frame: Frame | null = null;
  let start = { x: 0, y: 0 };
  let splashed = false;
  // The engine stops drawing when the hero scrolls away; appearances wait with it.
  let onScreen = true;
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }).observe(ocean.canvas);
  // Clear at once, so the engine's reduced-motion still frame never bakes in a half-drawn Lugia.
  reduced.addEventListener("change", () => {
    if (!reduced.matches) return;
    frame = null;
    ocean.setRepel(null);
  });

  const layer = (depth: "under" | "over"): Layer => ({
    depth,
    draw(ctx, g) {
      grid = g;
      if (!frame || frame.layer !== depth || reduced.matches) return;
      const mask = frame.phase === "breach" && breach ? breach : pose;
      drawCreature(ctx, g, mask, frame, lugia.colors, document.documentElement.dataset.theme === "light");
    },
  });
  ocean.addLayer(layer("under"));
  ocean.addLayer(layer("over"));

  const place = () => {
    const r = ocean.canvas.getBoundingClientRect();
    start = { x: r.width * (1 / 3 + Math.random() / 3), y: r.height * (0.4 + 0.2 * Math.random()) };
    splashed = false;
  };

  let last = performance.now();
  let wasRunning = false;
  const tick = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    requestAnimationFrame(tick);
    const t = schedule.update(dt, { paused: document.hidden || !onScreen, reduced: reduced.matches });
    if (t === null) {
      if (wasRunning) { frame = null; ocean.setRepel(null); }
      wasRunning = false;
      return;
    }
    if (!wasRunning) place();
    wasRunning = true;
    const r = ocean.canvas.getBoundingClientRect();
    const cw = grid?.cw ?? 12;
    const aspect = pose.h / pose.w;
    frame = frameAt(t, start, { w: r.width, h: r.height, cw }, aspect);
    if (!frame) {
      schedule.finish();
      ocean.setRepel(null);
      wasRunning = false;
      return;
    }
    const half = (frame.widthCells * cw) / 2;
    ocean.setRepel(frame.phase === "deep" ? { x: frame.x, y: frame.y, r: half } : null);
    if (frame.phase === "breach" && !splashed) {
      splashed = true;
      ocean.splash(frame.x, frame.y);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ocean.splash(frame.x + Math.cos(a) * half, frame.y + Math.sin(a) * half * aspect);
      }
    }
  };
  requestAnimationFrame(tick);

  opts.onReady(() => { schedule.summon(reduced.matches); }, () => schedule.busy() || reduced.matches);
}
