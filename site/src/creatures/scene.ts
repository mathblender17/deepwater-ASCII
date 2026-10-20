/** What a creature's appearance looks like at one moment: circles on the water, foam, and the creature itself. */
export const GAP_CELLS = 6;
/** Radius of Lugia's fully formed circle, px (about 67 cells across); other creatures scale it. */
export const discRadius = (cw: number) => 1.5 * (45 * cw) / 2;

export type Circle = { x: number; y: number; r: number; tint: number };
/** A foam ring burst: three rings spreading to progress · reach. */
export type Foam = { x: number; y: number; progress: number; reach: number };
export type Sprite = {
  pose: "main" | "breach";
  x: number;
  y: number;
  widthCells: number;
  brightness: number;
  /** Vertical scale for the wing beat, 0.92–1. */
  squash: number;
  /** Radians, clockwise (canvas y points down). */
  angle: number;
  layer: "under" | "over";
};
export type SerpentNode = { x: number; y: number };
export type Serpent = { nodes: SerpentNode[]; angle: number; widthCells: number; brightness: number };
export type Scene = {
  phase: string;
  circles: Circle[];
  foams: Foam[];
  sprite: Sprite | null;
  serpent: Serpent | null;
  /** Extra areas kept empty, e.g. a flight path. */
  path: { x: number; y: number; r: number }[];
};

/** Areas fish and sharks are pushed out of: every open circle plus the gap, then the path. */
export function clearZones(s: Scene, cw: number): { x: number; y: number; r: number }[] {
  return [...s.circles.filter((c) => c.r > 0).map((c) => ({ x: c.x, y: c.y, r: c.r + GAP_CELLS * cw })), ...s.path];
}
