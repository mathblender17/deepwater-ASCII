# Kyogre and Gyarados Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Kyogre (leap between two circles) and Gyarados (serpent swivel between two circles) to the ASCII ocean, alongside Lugia.

**Architecture:** Each motion becomes a pure `xAt(t, …) → Scene | null` (circles, foam rings, an optional rotated sprite, an optional serpent, extra clear zones). The water, sprite and serpent drawers render a scene; `index.ts` loads every creature in `pack.json`, picks who appears, and drives one scene at a time.

**Tech Stack:** TypeScript, Canvas 2D, Deno 2.9 tests, esbuild via Deno. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-20-kyogre-gyarados-design.md`

## Global Constraints

- `pokemon-pack/` stays git-ignored and uncommitted.
- Tests: `deno test --unstable-sloppy-imports site/src/creatures/` (full type-check). Type-check the bundle: `deno run -A npm:typescript@5.6.3/tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler --allowImportingTsExtensions --lib ES2022,DOM --skipLibCheck site/src/ocean.ts`. Rebuild: `deno run -A npm:esbuild@0.24.0 site/src/ocean.ts --bundle --format=iife --global-name=RoninOcean --minify --target=es2020 --outfile=site/ocean.js`.
- Pure modules (anything a test imports) must not reference DOM types.
- Lugia must look and time exactly as on `f34e5b5` (approved).
- Gap around every circle: 6 cells. Circle radii: Lugia `1.5·45·cw/2`, Kyogre 0.75×, Gyarados 0.45×.
- Weights: Gyarados 0.5, Lugia 0.25, Kyogre 0.25 (renormalised over loaded creatures).

## Review Focus

- A pack with only some creatures (e.g. no Gyarados head image) must still run the others → Task 5 browser check with one entry removed.
- Kyogre leaping left vs right must both keep it on screen → leap test with start near either edge.
- Gyarados's hidden body parts must never draw outside the circles (no body "teleporting" at A or B) → swivel test on visibility vs u.
- Summon for one creature while another is mid-appearance must not start a second → Task 5 browser check.
- Light mode for the new colours (red, cream, teal) must keep their hue → screenshots in Task 3 and 4.

---

### Task 1: Palette regions and rotated sampling

**Files:** Modify `site/src/creatures/mask.ts`; create `site/src/creatures/geometry.ts`; tests `mask.test.ts`, `geometry.test.ts`.

**Interfaces — Produces:** `FIN = 4`; `type PaletteEntry = { rgb: [number, number, number]; region: number }`; `buildMask(rgba, w, h, palette?: PaletteEntry[])` — with a palette, inside pixels take the region of the nearest source colour (squared RGB distance); without, today's rules. `geometry.ts`: `cellToUV(px: number, py: number, s: { x: number; y: number; wPx: number; hPx: number; angle: number }): { u: number; v: number }` — rotates the point by −angle about (x, y) and maps the sprite box to 0–1.

- [ ] Tests first: `palette assigns nearest region` (square painted half `#1e79b8`, half `#c8304a`, palette blue→BODY, red→MARKS; sampleCell over each half returns the right region); `no palette keeps the rules` (existing tests unchanged); `cellToUV` — centre → (0.5, 0.5); with angle 0 the right edge midpoint → (1, 0.5); with angle π/2 the point `(x, y + wPx/2)` → (1, 0.5).
- [ ] Run → FAIL; implement; run → PASS; commit `Add palette regions and rotated sampling`.

### Task 2: Scenes, with Lugia moved onto them

**Files:** Create `site/src/creatures/scene.ts`; rename `timeline.ts` → `rise.ts` (and its test → `rise.test.ts`); move `nextGap` into `scheduler.ts`; modify `water.ts`, `draw.ts`, `index.ts`.

**Interfaces — Produces (scene.ts):** `GAP_CELLS = 6`; `discRadius(cw)`; `type Circle = { x: number; y: number; r: number; tint: number }`; `type Foam = { x: number; y: number; progress: number; reach: number }` (ring radius = progress·reach); `type Sprite = { pose: "main" | "breach"; x: number; y: number; widthCells: number; brightness: number; squash: number; angle: number; layer: "under" | "over" }`; `type SerpentNode = { x: number; y: number }`; `type Serpent = { nodes: SerpentNode[]; angle: number; widthCells: number; brightness: number }`; `type Scene = { phase: string; circles: Circle[]; foams: Foam[]; sprite: Sprite | null; serpent: Serpent | null; path: { x: number; y: number; r: number }[] }`; `clearZones(s: Scene, cw: number)` → every circle with `r > 0` as `{x, y, r: r + GAP_CELLS·cw}`, then `s.path`.
**rise.ts:** `RISE_TOTAL`, `riseAt(t, start, view, aspect): Scene | null` — identical timing and values to today's `frameAt` (circle r = zone·discRadius, foam reach = discRadius·2.2, sprite pose "breach" during breach, angle 0, path = the flight corridor).
**water.ts:** `drawWater(ctx, grid, scene, light)` draws every circle (teal inside, rim at r) and every foam (three rings) as today. **draw.ts:** `drawSprite(ctx, grid, mask, sprite, colors, light)` uses `cellToUV` for rotation; colours `Record<string, string>` keyed body/belly/marks/fin.

- [ ] Port the existing Lugia tests to `riseAt` + `clearZones(scene)` (same assertions, read through `scene.sprite` / `scene.circles[0]` / `scene.foams`); add `clearZones returns circle plus gap and path`.
- [ ] Run → FAIL; implement; run → PASS (all suites).
- [ ] Rebuild; screenshot Lugia in dark at 0.5, 2.5, 3.75, 5.8 s and compare with the approved run (same circle, gap, foam, flight).
- [ ] Commit `Move Lugia onto scenes`.

### Task 3: Kyogre's leap

**Files:** Create `site/src/creatures/leap.ts`, `leap.test.ts`; modify `index.ts`; local `pokemon-pack/pack.json`.

**Interfaces — Produces:** `LEAP_TOTAL = 9.2`; `leapAt(t, a: {x,y}, b: {x,y}, view: {w,h,cw}, aspect): Scene | null`. Phases: `gather` 3 (A: 0 → R), `surface` 0.6 (sprite pose "breach", 30 → 40 cells, ease-out, over), `leap` 1.6 (main pose, x/y along a→b with a slight arc, width 40 → 56 at mid → 34, brightness 1 → 0.5 in the last third, angle = atan2(b − a)), `stay` 2.5 (under, brightness 0.35, angle turning ≤ 30°), `deep` 1.5 (width 34 → 6, brightness 0.35 → 0). R = 0.75·discRadius. A: open in gather, closes over `leap`. B: opens from the start of `surface` to full by the start of `stay`, closes over `deep`. Foams: at A at the start of `surface`, at B at the start of `stay` (2 s each). `leapTarget(a, view, rand): {x,y}` picks b at ±0.4·w (towards the side with more room), y ± 0.1·h, clamped inside the view by R.

- [ ] Tests: phase order; sprite null in gather; under/dim in stay; B fully open at landing (r ≈ R at `stay` start); A closed by end of leap; B closed at end; width peaks mid-leap; `leapTarget` keeps b inside the view for a at 10% and 90% of width.
- [ ] Run → FAIL; implement; PASS.
- [ ] Add `kyogre` to `pack.json` (role legendary, motion leap, pose `kyogre side view.webp`, breach `kyogre bottom view.webp`, facing ≈ 153°, palette blues→body, `#c5d6ea`→belly, `#c8304a`→marks; colours body `#2f7fd6`, belly `#e6eef7`, marks `#d8344f`). Wire `index.ts` to run `leapAt` when Kyogre is summoned (summon by name for now).
- [ ] Screenshots dark + light through every phase; tune `facing` until the head leads; commit `Add Kyogre's leap`.

### Task 4: Gyarados's swivel

**Files:** Create `site/src/creatures/swivel.ts`, `swivel.test.ts`, `serpent-draw.ts`; modify `index.ts`; local `pack.json`.

**Interfaces — Produces:** `NODES = 24`; `SWIVEL_TOTAL = 8.5`; `pathPoint(u, a, b): {x, y}` — straight a→b plus an S offset `sin(2πu)·0.18·|b − a|` perpendicular; `swivelAt(t, a, b, view): Scene | null` — phases `gather` 2.5 (A opens; R = 0.45·discRadius), `swim` 4.8 (head u: 0 → 1 + L where L = body length in u, ≈ 70 cells / path length), `dive` 1.2 (B closes). Serpent nodes: node k at `u_k = u_head − k·L/(NODES − 1)`, included only when `0 ≤ u_k ≤ 1`; `angle` = heading at the head; `widthCells` 6. B opens when the head passes u = 0.5 (full by u = 1); A closes once `u_tail > 0`. Foams at A when the head first leaves (u_head = 0⁺) and at B when it enters (u_head = 1). Path clear zones: circles of radius `widthCells·cw` at every visible node. `drawSerpent(ctx, grid, serpent, headMask | null, colors, light)` (in `serpent-draw.ts`, not unit-tested): capsule bands between visible nodes tapering 100% → 35% to the tail; cells on one side of the spine get belly colour; every 3rd node a fin spike; head mask (crop from `headCrop`) drawn rotated at node 0.

- [ ] Tests: phase order; serpent null in gather; all visible nodes satisfy `0 ≤ u ≤ 1` (so none outside the two circles' path); spacing between consecutive visible nodes within 15% of each other; the head is ahead of node 1 along travel; nothing visible after the tail passes u = 1; B open when head reaches u = 1; A closed after the tail leaves.
- [ ] Run → FAIL; implement; PASS.
- [ ] Add `gyarados` to `pack.json` (role visitor, motion swivel, head `garados side view.webp`, headCrop `[0.56, 0, 1, 0.62]`, palette teal→body, `#f6df94`→belly, `#3d4a4a`→marks, whites→fin; colours body `#3fa9b5`, belly `#f3dc8e`, marks `#22393d`, fin `#eef4f6`). Crop support: build the head mask from the cropped region.
- [ ] Screenshots dark + light through every phase; commit `Add Gyarados's swivel`.

### Task 5: Who appears, and Summon

**Files:** Modify `scheduler.ts` (+ test), `index.ts`, `site/index.html`.

**Interfaces — Produces:** `pickCreature(rand: () => number, loaded: { name: string; role: "legendary" | "visitor" }[]): string` — visitors share 0.5, legendaries share 0.5 (each group split evenly), renormalised when a group is empty. `mountCreatures` calls `onReady(creatures: string[], summon(name): void, busy(): boolean)`; Tune's group is renamed **Summon** with one button per loaded creature (label = capitalised name).

- [ ] Tests: `pickCreature` with all three — rand 0.0→gyarados, 0.6→lugia, 0.9→kyogre (given order gyarados, lugia, kyogre); with only legendaries the halves renormalise.
- [ ] Run → FAIL; implement; PASS.
- [ ] Wire index.ts/html; browser checks: each Summon button runs its creature; pressing another while one runs does nothing; remove `gyarados` from pack.json → others still work; reduced motion still suppresses all.
- [ ] Lint + inspector (0 FAIL); `git check-ignore pokemon-pack/pack.json`; commit `Summon any loaded creature; pick who appears`.
