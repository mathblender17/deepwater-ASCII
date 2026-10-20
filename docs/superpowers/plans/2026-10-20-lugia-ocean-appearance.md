# Lugia Ocean Appearance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lugia, loaded from local art, rises from deep water, breaches and flies up at the camera over the existing ASCII ocean.

**Architecture:** Pure modules (mask cut-out, appearance timeline) are unit-tested with Deno. A small hook in the vendored engine lets extra layers draw under or over the sharks and lets callers repel fish/sharks and trigger splashes. A browser-only `mountCreatures` loads `pokemon-pack/pack.json`, schedules appearances and draws Lugia cell by cell.

**Tech Stack:** TypeScript, Canvas 2D, Deno 2.9 (`deno test`, esbuild via `npm:esbuild@0.24.0`), no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-20-lugia-ocean-appearance-design.md`

## Global Constraints

- `pokemon-pack/` stays git-ignored; nothing from it is committed. Without it the page behaves exactly as today.
- Appearance: deep ~3 s (25 → 45 cells wide, ≈35% brightness), breach ~0.6 s, flight ~3 s (45 → 110+ cells, off the top edge).
- First appearance 8–12 s after load, then random 25–45 s gaps; one at a time.
- Disabled under `prefers-reduced-motion`; timer paused while `document.hidden`.
- Colours from `pack.json`; in light theme (`html[data-theme=light]`) creature colours are pre-inverted because the canvas is CSS-inverted.
- Rebuild `site/ocean.js` after any change under `vendor-ascii-sharks/src` or `site/src`:
  `deno run -A npm:esbuild@0.24.0 site/src/ocean.ts --bundle --format=iife --global-name=RoninOcean --minify --target=es2020 --outfile=site/ocean.js`
- Imports inside `site/src/creatures/` use explicit `.ts` extensions (works for both Deno tests and esbuild).

## Review Focus

- A pose image whose background is a painted checkerboard (no alpha) must still cut out cleanly → covered by a mask test with a synthetic checkerboard.
- Pure-white body pixels enclosed by an outline must count as inside, not background → covered by the hole-fill mask test.
- Changing species or school size in Tune restarts the engine; creature layers and repel must survive the restart → covered by Task 1 browser check.
- Summon pressed during an appearance must not start a second one → covered by Task 4 browser check.
- Opening the page via `file://` or with no pack must not throw → covered by Task 5 checks.

---

### Task 1: Engine hooks for layers, repel and splash

**Files:**
- Modify: `vendor-ascii-sharks/src/renderer.ts` (end of `render()`)
- Modify: `vendor-ascii-sharks/src/world.ts` (fish flee loop, shark steering)
- Modify: `vendor-ascii-sharks/src/engine.ts`
- Modify: `site/src/ocean.ts`

**Interfaces:**
- Produces (renderer.ts): `export type Grid = { cw: number; ch: number; cols: number; rows: number; t: number }`; `export type Layer = { depth: "under" | "over"; draw(ctx: CanvasRenderingContext2D, grid: Grid): void }`; public `layers: Layer[]` on `AsciiRenderer`. `under` layers draw after `drawFish()` and before `drawSharks(t)`; `over` layers after `drawSharks(t)`. Font/textAlign/baseline are already set when layers run.
- Produces (world.ts): public `repel: { x: number; y: number; r: number } | null = null`. Fish inside `r` get the same push as the cursor's scare (use `FISH_FLEE_K`, weight `(1 - d/r)^2`, raise `fear`); sharks whose head is within `r * 1.3` steer away (weight `(1 - d/(r*1.3)) * 3`, like the existing shark-separation term).
- Produces (engine.ts): `addLayer(layer: Layer): void`, `setRepel(r: World["repel"]): void`, `splash(x: number, y: number): void` (calls `world.splash`). Re-export `Layer`, `Grid` from `vendor-ascii-sharks/src/index.ts`.
- Produces (site/src/ocean.ts): the object returned by `mountOcean` gains `addLayer(layer)`, `setRepel(r)`, `splash(x, y)`, `canvas: HTMLCanvasElement`. Layers and the current repel are stored in the wrapper and re-applied inside `start()` so a roster change keeps them.

- [ ] **Step 1:** Implement the renderer, world and engine changes above.
- [ ] **Step 2:** Type-check: `deno run -A npm:typescript@5.6.3/tsc --noEmit -p vendor-ascii-sharks` → no output, exit 0.
- [ ] **Step 3:** Implement the `ocean.ts` pass-through; type-check: `deno run -A npm:typescript@5.6.3/tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler --lib ES2022,DOM --skipLibCheck site/src/ocean.ts` → exit 0.
- [ ] **Step 4:** Rebuild `site/ocean.js`. In the browser (local server on 4173) run in the console: `const o = /* the mounted ocean */; o.addLayer({depth:"over", draw(c,g){c.fillStyle="red"; c.fillRect(0,0,g.cw*4,g.ch*2)}})` and confirm a red block top-left; change Species in Tune and confirm the block is still there. Expose the mounted ocean for this check as `window.__ocean` in `site/index.html` (keep it; Task 4 uses it).
- [ ] **Step 5:** Commit: `git add vendor-ascii-sharks site/src/ocean.ts site/ocean.js site/index.html && git commit -m "Add engine hooks for creature layers, repel and splash"`

### Task 2: Mask cut-out

**Files:**
- Create: `site/src/creatures/mask.ts`
- Test: `site/src/creatures/mask.test.ts`

**Interfaces:**
- Produces: `export const EMPTY = 0, BODY = 1, BELLY = 2, MARKS = 3;` `export type Mask = { w: number; h: number; px: Uint8Array /* region per pixel */; coverage: number /* inside px / bbox area */ }`; `export function buildMask(rgba: Uint8ClampedArray, w: number, h: number): Mask` (cropped to the bounding box of inside pixels); `export function sampleCell(m: Mask, u0: number, v0: number, u1: number, v1: number): { coverage: number; region: number }` where `u,v` are 0–1 fractions of the mask and `region` is the most common non-empty region in that rectangle.

Algorithm (not determined by the signature):
1. Background: if more than 5% of pixels have alpha < 250, background = alpha < 128. Otherwise background = light and neutral: `lum > 0.75 && max(|r-g|,|g-b|,|b-r|) <= 4` where `lum = (0.3r + 0.59g + 0.11b)/255`.
2. Close gaps: dilate then erode the inside set by 2 px.
3. Fill holes: flood-fill from the image border through non-inside pixels; everything not reached is inside.
4. Regions for inside pixels: `MARKS` if `lum < 0.45 && b - r > 30`; `BELLY` if `lum >= 0.45 && b - r > 25`; else `BODY`.

- [ ] **Step 1: Write failing tests** in `mask.test.ts` (import from `./mask.ts`, `assertEquals`/`assert` from `jsr:@std/assert@1.0.8`):
  - `checkerboard background is removed`: 40×40 image, 8-px checker of (255,255,255)/(230,230,230), a filled 20×20 square of (238,241,246) with a 1-px (20,20,20) outline at 10..29 → `buildMask(...).w === 20 && .h === 20`, `coverage > 0.95`.
  - `enclosed white counts as inside`: same image with the square's interior pure (255,255,255) → `coverage > 0.95`.
  - `regions are labelled`: inside the square paint a 6×6 patch (44,54,120) and a 6×6 patch (169,188,232) → `sampleCell` over each patch returns `region === MARKS` and `region === BELLY`; over plain interior `BODY`.
  - `alpha images use alpha`: 30×30 RGBA, alpha 0 except a 10×10 opaque white block → `w === 10`.
  - `empty image`: all background → `coverage === 0` and `w === 0`.
- [ ] **Step 2:** `deno test site/src/creatures/mask.test.ts` → FAIL (module not found).
- [ ] **Step 3:** Implement `buildMask` and `sampleCell`.
- [ ] **Step 4:** `deno test site/src/creatures/mask.test.ts` → all pass.
- [ ] **Step 5:** Commit: `git add site/src/creatures/mask.ts site/src/creatures/mask.test.ts && git commit -m "Add creature mask cut-out with region labels"`

### Task 3: Appearance timeline

**Files:**
- Create: `site/src/creatures/timeline.ts`
- Test: `site/src/creatures/timeline.test.ts`

**Interfaces:**
- Produces: `export const DEEP = 3, BREACH = 0.6, FLIGHT = 3, TOTAL = DEEP + BREACH + FLIGHT;` `export type Frame = { phase: "deep" | "breach" | "flight"; x: number; y: number; widthCells: number; brightness: number; squash: number; layer: "under" | "over" }`; `export function frameAt(t: number, start: { x: number; y: number }, view: { w: number; h: number; cw: number }, aspect: number): Frame | null` — `t` seconds since the appearance began, `start` the centre in px, `aspect` = mask h / w; returns `null` when `t >= TOTAL`. `export function nextGap(rand: () => number, first: boolean): number` → seconds: `8 + 4·rand()` when `first`, else `25 + 20·rand()`.

Values: deep width 25 → 45 cells, brightness 0.35, slow drift (≤ 2 cells), beat 0.6 Hz, layer `under`. Breach: width 45, brightness ramps 0.35 → 1, layer `over`. Flight: width 45 → 120 cells (ease-in), brightness 1, beat 2 Hz, `y` moves up so the sprite's bottom edge passes `y < 0` by `t = TOTAL`. `squash = 0.92 + 0.08 · (0.5 + 0.5·cos(2π·f·t))`.

- [ ] **Step 1: Write failing tests:**
  - `phases run in order`: `frameAt(0.5,…).phase === "deep"`, `frameAt(3.3,…).phase === "breach"`, `frameAt(4,…).phase === "flight"`, `frameAt(TOTAL,…) === null`.
  - `deep is dim and under, flight is bright and over`: brightness ≈ 0.35 and layer `under` at 1 s; brightness 1 and layer `over` at 5 s.
  - `width grows`: widths at 0, 1.5, 3, 4, 6.5 s are strictly increasing; ≈25 at 0 and ≥110 at 6.55 s.
  - `ends off the top`: at `t = TOTAL - 0.01`, `y + (widthCells·cw·aspect)/2 < 0` for `view = {w:1440,h:900,cw:12}`, `aspect = 0.77`, `start = {x:720,y:450}`.
  - `gaps`: `nextGap(() => 0, true) === 8`, `nextGap(() => 1, true) === 12`, `nextGap(() => 0, false) === 25`, `nextGap(() => 1, false) === 45`.
- [ ] **Step 2:** `deno test site/src/creatures/timeline.test.ts` → FAIL.
- [ ] **Step 3:** Implement `frameAt` and `nextGap`.
- [ ] **Step 4:** `deno test site/src/creatures/` → all pass.
- [ ] **Step 5:** Commit: `git add site/src/creatures/timeline.* && git commit -m "Add Lugia appearance timeline"`

### Task 4: Draw and mount Lugia

**Files:**
- Create: `site/src/creatures/draw.ts`, `site/src/creatures/index.ts`
- Create (local only, ignored): `pokemon-pack/pack.json` with the JSON from the spec §1
- Modify: `site/src/ocean.ts` (export `mountCreatures` from the bundle), `site/index.html` (Tune group + startup call)

**Interfaces:**
- Consumes: Task 1 wrapper (`addLayer`, `setRepel`, `splash`, `canvas`), Task 2 `buildMask`/`sampleCell`/regions, Task 3 `frameAt`/`nextGap`/`TOTAL`.
- Produces: `export function drawCreature(ctx: CanvasRenderingContext2D, grid: Grid, mask: Mask, f: Frame, colors: { body: string; belly: string; marks: string }, light: boolean): void` and `export async function mountCreatures(ocean: ReturnType<typeof mountOcean>, opts: { packUrl: string; onReady(summon: () => void, busy: () => boolean): void }): Promise<void>`.

Drawing rules (`draw.ts`): for each cell overlapping the frame's rectangle (width `widthCells·cw`, height `width·aspect·squash`), sample the mask. Coverage < 0.18 → skip; < 0.55 → edge glyph from `".',\`"` in the body colour at 60% brightness; else filled block (`fillRect(x+1, y+1, cw-1, ch-1)`) in the region colour scaled by `brightness`, plus glyph: BODY from the shark skin ramp `":;t%SX8#@"` by cell shade, BELLY `":"`, MARKS `"#"`, glyph colour `#0e0f13` (or the colour's 30% shade for MARKS). In flight, 4% of cells per frame (hash of cell + floor(t·2.4)) shimmer in one of `#e0892c #33c8cc #b44ae0 #3150e8`. Deep phase: no shimmer. When `light`, invert every colour (`255 - c` per channel) before use.

Mount rules (`index.ts`): fetch `packUrl`; on any failure or missing `lugia` entry → `console.warn` once and return without calling `onReady`. Load `pose` (and `breach`) via `new Image()` → offscreen canvas → `getImageData` → `buildMask`; if `coverage > 0.9` or `w === 0` → warn and return; `console.assert(coverage >= 0.35 && coverage <= 0.6)` for the pose. One `over` and one `under` layer, each drawing only when the current frame's `layer` matches. While deep, `setRepel({x, y, r: widthPx/2})`; at the breach start call `splash` at the centre and at 6 points on the outline; clear repel after the breach. Breach phase draws the `breach` mask if present. Scheduler on `requestAnimationFrame`: skip when `matchMedia("(prefers-reduced-motion: reduce)").matches`; accumulate time only while `!document.hidden`; start position x in the middle third, y in 40–60% of height. `summon()` starts immediately unless `busy()`.

`index.html`: in the Tune panel after "On screen", add `<h2>Legendaries</h2><div class="group"><div class="row"><span>Lugia</span><button class="btn" type="button" id="summon" hidden>Summon</button></div></div>` (hide the whole group until ready); after the ocean mounts, call `RoninOcean.mountCreatures(ocean, { packUrl: "../pokemon-pack/pack.json", onReady })`, where `onReady` unhides the group, wires the click to `summon`, and toggles `disabled` from `busy()` every 250 ms.

- [ ] **Step 1:** Write `pokemon-pack/pack.json`; check `git status --short` shows nothing from `pokemon-pack/`.
- [ ] **Step 2:** Implement `draw.ts` and `index.ts`; export `mountCreatures` from `site/src/ocean.ts`; type-check as in Task 1 Step 3; `deno test site/src/creatures/` still passes.
- [ ] **Step 3:** Rebuild `site/ocean.js`; wire `index.html`. Serve the project root (not `site/`) so `../pokemon-pack/` resolves: update `.claude/launch.json` runtimeArgs to serve `.` and open `/site/`.
- [ ] **Step 4:** Browser check at `http://localhost:4173/site/`: no console errors; Legendaries group visible; Summon → screenshots at ~1.5 s (deep: dim, under sharks, fish scattering), ~3.3 s (breach splash), ~5 s (flight: white/blue/navy, over sharks, growing); Summon is disabled during the run and a second click does nothing; repeat with `?theme=light` (Lugia stays white and navy); wait ≤ 12 s after a fresh load for the automatic first appearance.
- [ ] **Step 5:** Commit (code only): `git add site/src site/ocean.js site/index.html .claude/launch.json && git status --short` (confirm no `pokemon-pack` paths) `&& git commit -m "Add Lugia rising from the ocean"`

### Task 5: Failure paths and final gate

**Files:**
- Modify only if a check fails.

- [ ] **Step 1:** Rename `pokemon-pack/pack.json` temporarily → reload → no thrown errors, one warning, no Legendaries group, ocean normal; restore it.
- [ ] **Step 2:** Open `site/index.html` via `file://` → page and ocean work; creatures absent with one console note.
- [ ] **Step 3:** Emulate reduced motion (DevTools rendering panel or `matchMedia` override) → no appearance after 15 s.
- [ ] **Step 4:** `deno run -A C:/Users/Meghraj/.claude/skills/design-taste-frontend/scripts/lint.mjs site/index.html` and `.../inspect.mjs site/index.html` → 0 FAIL.
- [ ] **Step 5:** `git check-ignore pokemon-pack/pack.json` prints the path; `git log -1 --stat` lists no `pokemon-pack` files. Commit any fixes.
