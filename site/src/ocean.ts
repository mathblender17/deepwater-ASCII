/**
 * Ronin's wrapper around stackedlol/ascii-sharks.
 *
 * The engine's roster is fixed for the life of a canvas, so changing species or
 * school size means tearing the engine down and starting a fresh one on the
 * same canvas. Phase 2 (kraken / legendary) plugs in here: add a creature kind
 * to the vendor world + renderer, then expose it through `Roster`.
 */
import { OceanEngine, type Layer, type SharkKind, type SharkSpec } from "../../vendor-ascii-sharks/src";

export type Kind = SharkKind | "mixed";
export type Roster = { kind: Kind; count: number };
export type Interaction = { cursor: "scare" | "bait"; click: "splash" | "feed" };

const ALL_KINDS: SharkKind[] = ["classic", "hammerhead", "zebra", "tiger", "greathammer", "mako", "thresher", "nurse"];

export const SPECIES: { kind: Kind; label: string }[] = [
  { kind: "mixed", label: "Mixed" },
  { kind: "classic", label: "Reef" },
  { kind: "hammerhead", label: "Hammerhead" },
  { kind: "greathammer", label: "Great hammer" },
  { kind: "thresher", label: "Thresher" },
  { kind: "mako", label: "Mako" },
  { kind: "tiger", label: "Tiger" },
  { kind: "zebra", label: "Zebra" },
  { kind: "nurse", label: "Nurse" },
];

/** Biggest first, the rest step down. "mixed" deals every kind once (shuffled) before repeating. */
export function specs({ kind, count }: Roster): SharkSpec[] {
  const kinds = kind === "mixed" ? [...ALL_KINDS].sort(() => Math.random() - 0.5) : [kind];
  return Array.from({ length: count }, (_, i) => ({
    kind: kinds[i % kinds.length],
    size: 1 - i * (0.35 / Math.max(1, count - 1)),
  }));
}

export type Repel = { x: number; y: number; r: number } | null;

export function mountOcean(canvas: HTMLCanvasElement, roster: Roster, interaction: Interaction) {
  // Kept here so they survive the engine restarts that roster changes cause.
  const layers: Layer[] = [];
  let repel: Repel = null;
  const start = () => {
    const e = new OceanEngine(canvas, specs(roster));
    e.setKeepCenterClear(false);
    e.setCursorMode(interaction.cursor);
    e.clickMode = interaction.click;
    for (const l of layers) e.addLayer(l);
    e.setRepel(repel);
    return e;
  };
  let engine = start();
  return {
    canvas,
    addLayer(layer: Layer) {
      layers.push(layer);
      engine.addLayer(layer);
    },
    setRepel(r: Repel) {
      repel = r;
      engine.setRepel(r);
    },
    splash(x: number, y: number) {
      engine.splash(x, y);
    },
    set(next: Roster) {
      roster = next;
      engine.destroy();
      engine = start();
    },
    interact(next: Partial<Interaction>) {
      Object.assign(interaction, next);
      engine.setCursorMode(interaction.cursor);
      engine.clickMode = interaction.click;
    },
    destroy() {
      engine.destroy();
    },
  };
}

// Self-check: a mixed school of 8 holds every kind exactly once.
{
  const kinds = specs({ kind: "mixed", count: 8 }).map((s) => s.kind);
  console.assert(new Set(kinds).size === ALL_KINDS.length, "mixed roster should hold every shark kind");
}

export { mountCreatures } from "./creatures/index.ts";
