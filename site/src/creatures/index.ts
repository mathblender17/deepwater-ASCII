/**
 * Loads creatures from the local Pokémon pack and schedules their appearances.
 * The pack is git-ignored: without it this does nothing and the ocean runs as before.
 */
import type { Grid, Layer } from "../../../vendor-ascii-sharks/src/renderer.ts";
import { type Colors, drawSprite, rgbOf } from "./draw.ts";
import { BELLY, BODY, buildMask, FIN, MARKS, type Mask, type PaletteEntry } from "./mask.ts";
import { leapAt, leapTarget } from "./leap.ts";
import { riseAt } from "./rise.ts";
import { clearZones, type Scene } from "./scene.ts";
import { Scheduler } from "./scheduler.ts";
import { drawWater } from "./water.ts";

type Ocean = {
  canvas: HTMLCanvasElement;
  addLayer(layer: Layer): void;
  setRepel(zones: { x: number; y: number; r: number }[]): void;
  splash(x: number, y: number): void;
};
type View = { w: number; h: number; cw: number };
type Point = { x: number; y: number };

/** One creature's entry in pokemon-pack/pack.json. */
type Entry = {
  role?: "legendary" | "visitor";
  motion?: "rise" | "leap" | "swivel";
  pose?: string;
  breach?: string;
  head?: string;
  /** [left, top, right, bottom] as fractions of the head image. */
  headCrop?: [number, number, number, number];
  /** Degrees the image faces (0 = right, 90 = down). */
  facing?: number;
  /** Source colour → region name (body, belly, marks, fin). */
  palette?: [string, string][];
  colors: Colors;
};
export type Creature = {
  name: string;
  role: "legendary" | "visitor";
  motion: "rise" | "leap" | "swivel";
  main: Mask | null;
  breach: Mask | null;
  head: Mask | null;
  colors: Colors;
  facing: number;
};

const REGION: Record<string, number> = { body: BODY, belly: BELLY, marks: MARKS, fin: FIN };

async function loadMask(url: string, palette?: PaletteEntry[], crop?: [number, number, number, number]): Promise<Mask> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const [l, t, r, b] = crop ?? [0, 0, 1, 1];
  const sx = Math.round(l * img.naturalWidth), sy = Math.round(t * img.naturalHeight);
  const w = Math.max(1, Math.round((r - l) * img.naturalWidth)), h = Math.max(1, Math.round((b - t) * img.naturalHeight));
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const g = cv.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(img, sx, sy, w, h, 0, 0, w, h);
  // Throws on file:// (tainted canvas); the caller turns that into one console note.
  return buildMask(g.getImageData(0, 0, w, h).data, w, h, palette);
}

async function loadCreature(name: string, e: Entry, base: URL): Promise<Creature> {
  const palette = e.palette?.map(([hex, region]) => ({ rgb: rgbOf(hex), region: REGION[region] ?? BODY }));
  const url = (f: string) => new URL(f, base).href;
  const ok = (m: Mask | null) => (m && m.w && m.coverage <= 0.9 ? m : null);
  const main = e.pose ? ok(await loadMask(url(e.pose), palette)) : null;
  const breach = e.breach ? ok(await loadMask(url(e.breach), palette).catch(() => null)) : null;
  const head = e.head ? ok(await loadMask(url(e.head), palette, e.headCrop)) : null;
  if (!main && !head) throw new Error(`${name}: no usable image`);
  if (name === "lugia" && main) console.assert(main.coverage >= 0.35 && main.coverage <= 0.6, `Lugia cut-out coverage ${main.coverage.toFixed(2)} is outside 0.35–0.6`);
  return {
    name, role: e.role ?? "legendary", motion: e.motion ?? "rise", main, breach, head,
    colors: e.colors, facing: ((e.facing ?? 0) * Math.PI) / 180,
  };
}

/** Where an appearance happens, chosen once when it starts. */
type Placement = { a: Point; b: Point };

function place(c: Creature, view: View): Placement {
  if (c.motion === "leap") {
    const a = { x: view.w * (0.3 + 0.4 * Math.random()), y: view.h * (0.35 + 0.3 * Math.random()) };
    return { a, b: leapTarget(a, view, Math.random) };
  }
  const a = { x: view.w * (1 / 3 + Math.random() / 3), y: view.h * (0.4 + 0.2 * Math.random()) };
  return { a, b: a };
}

function sceneAt(c: Creature, t: number, p: Placement, view: View): Scene | null {
  const aspect = c.main ? c.main.h / c.main.w : 1;
  switch (c.motion) {
    case "leap":
      return leapAt(t, p.a, p.b, view, aspect);
    default:
      return riseAt(t, p.a, view, aspect);
  }
}

export async function mountCreatures(ocean: Ocean, opts: { packUrl: string; onReady(summon: (name?: string) => void, busy: () => boolean, names: string[]): void }) {
  const creatures: Creature[] = [];
  try {
    const packUrl = new URL(opts.packUrl, location.href);
    const res = await fetch(packUrl);
    if (!res.ok) throw new Error(`no pack at ${packUrl.pathname} (${res.status})`);
    const pack: Record<string, Entry> = await res.json();
    for (const [name, entry] of Object.entries(pack)) {
      try {
        creatures.push(await loadCreature(name, entry, packUrl));
      } catch (e) {
        console.warn(`Creature skipped: ${(e as Error).message}`);
      }
    }
    if (!creatures.length) throw new Error("no creature in pack.json could be loaded");
  } catch (e) {
    console.warn(location.protocol === "file:" ? "Creatures need the local server (images can't be read from file://)." : `Creatures skipped: ${(e as Error).message}`);
    return;
  }

  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const schedule = new Scheduler();
  const light = () => document.documentElement.dataset.theme === "light";
  let grid: Grid | null = null;
  let scene: Scene | null = null;
  let current: { creature: Creature; placement: Placement } | null = null;
  let requested: string | null = null;
  let foamsSeen = new Set<string>();
  // The engine stops drawing when the hero scrolls away; appearances wait with it.
  let onScreen = true;
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }).observe(ocean.canvas);
  // Clear at once, so the engine's reduced-motion still frame never bakes in a half-drawn creature.
  reduced.addEventListener("change", () => {
    if (!reduced.matches) return;
    scene = null;
    ocean.setRepel([]);
  });

  ocean.addLayer({ depth: "water", draw(ctx, g) { grid = g; if (scene && !reduced.matches) drawWater(ctx, g, scene, light()); } });
  const spriteLayer = (depth: "under" | "over"): Layer => ({
    depth,
    draw(ctx, g) {
      const s = scene?.sprite;
      if (!s || s.layer !== depth || !current || reduced.matches) return;
      const c = current.creature;
      const mask = s.pose === "breach" && c.breach ? c.breach : c.main;
      if (mask) drawSprite(ctx, g, mask, s, c.colors, light(), c.facing);
    },
  });
  ocean.addLayer(spriteLayer("under"));
  ocean.addLayer(spriteLayer("over"));

  const view = (): View => {
    const r = ocean.canvas.getBoundingClientRect();
    return { w: r.width, h: r.height, cw: grid?.cw ?? 12 };
  };
  const begin = () => {
    const pick = creatures.find((c) => c.name === requested) ?? creatures[Math.floor(Math.random() * creatures.length)];
    requested = null;
    current = { creature: pick, placement: place(pick, view()) };
    foamsSeen = new Set();
  };
  const end = () => {
    scene = null;
    current = null;
    ocean.setRepel([]);
  };

  let last = performance.now();
  const tick = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    requestAnimationFrame(tick);
    const t = schedule.update(dt, { paused: document.hidden || !onScreen, reduced: reduced.matches });
    if (t === null) {
      if (current) end();
      return;
    }
    if (!current) begin();
    const v = view();
    scene = sceneAt(current!.creature, t, current!.placement, v);
    if (!scene) {
      schedule.finish();
      end();
      return;
    }
    ocean.setRepel(clearZones(scene, v.cw));
    // A new foam burst shoves the water outward: a splash at its centre and around its circle's edge.
    for (const f of scene.foams) {
      const key = `${Math.round(f.x)},${Math.round(f.y)}`;
      if (foamsSeen.has(key)) continue;
      foamsSeen.add(key);
      const R = scene.circles.find((c) => Math.hypot(c.x - f.x, c.y - f.y) < 1)?.r ?? f.reach / 2.2;
      ocean.splash(f.x, f.y);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        ocean.splash(f.x + Math.cos(a) * R, f.y + Math.sin(a) * R);
      }
    }
  };
  requestAnimationFrame(tick);

  opts.onReady(
    (name) => {
      if (schedule.busy() || reduced.matches) return;
      requested = name ?? null;
      schedule.summon(false);
    },
    () => schedule.busy() || reduced.matches,
    creatures.map((c) => c.name),
  );
}
