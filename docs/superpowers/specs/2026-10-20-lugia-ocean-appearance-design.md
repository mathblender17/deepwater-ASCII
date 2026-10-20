# Lugia rises from the ocean — design

Date: 2026-10-20 · Status: draft for review

## Goal

The hero becomes a Pokémon-themed ASCII scene. This first slice adds the creature engine and one creature, Lugia, with one event: it rises from deep water, breaches, and flies up at the camera. Coolness is the bar; the UI stays minimal.

Later slices (out of scope here): more creatures (Kyogre, Rayquaza, Latios/Latias, Mantine, Dragonite, Pelipper, Gyarados, Wailord), the sky biome, the hover appearance, biome switcher, camera-follow transitions, scroll-as-altitude, an original Chinese-style dragon.

## Decisions already made

- Pokémon art stays local: `pokemon-pack/` is git-ignored. Without it, the page runs exactly as today. Public builds will use original creatures later.
- Small fish stay plain dashes and dots.
- Lugia uses the front, wings-raised pose (`Lugia-front.webp`). Side poses did not read well on the grid.
- Wing beat is procedural (squash + bob), because the two front images are different drawings and would jump if alternated. `Lugia-Pokemon-front.webp` is shown only for the single breach downstroke.

## 1. Structure

- **Art loading at runtime.** `pokemon-pack/pack.json` lists creatures:
  ```json
  { "lugia": { "pose": "Lugia-front.webp", "breach": "Lugia-Pokemon-front.webp",
               "colors": { "body": "#eef1f6", "belly": "#a9bce8", "marks": "#2c3678" } } }
  ```
  The page loads each image, removes the background (alpha, or a painted checkerboard detected as neutral grey), labels each pixel empty / body / belly / marks, and keeps that mask.
- **Region rules:** marks = strongly blue and dark; belly = blue-tinted and light; body = everything else inside the outline. Holes inside the outline are filled; small gaps closed.
- **Code:** a new `site/src/creatures/` (mask loading, appearance timeline, drawing). The vendored engine gets one addition: a layer hook so extra layers draw either below the sharks or above everything. No other engine changes.
- **Light mode:** the canvas is inverted by CSS in light mode, so creature colours are pre-inverted there; Lugia stays white and navy in both themes.

## 2. The appearance (~7 s)

| Phase | Length | Visual | Scene reaction |
| --- | --- | --- | --- |
| Deep | ~3 s | Dim shadow (≈35% brightness, no markings shimmer) in the middle third, growing 25 → 45 cells wide, slow drift and slow wing beat; drawn below sharks | Fish inside its outline scatter; sharks steer away |
| Breach | ~0.6 s | Splash ring and cyan wake burst around the outline; one frame of the breach pose | All fish in a wide radius bolt |
| Flight | ~3 s | Full colour, drawn above everything, growing 45 → 110+ cells, faster wing beat, sweeps off the top edge | Water keeps moving underneath |

- **Timing:** first appearance 8–12 s after load, then a random 25–45 s gap; one at a time.
- **Summon:** a "Summon Lugia" button in a new *Legendaries* group in Tune; disabled during an appearance; hidden when no pack is loaded.
- Appearances continue in "Only the ocean" mode, are disabled under reduced motion, and the timer pauses while the tab is hidden.

## 3. Drawing, failures, testing

- **Cells:** each frame the mask is sampled at Lugia's size and position. Full coverage → filled block + glyph from the shark shading ramp; partial → light edge glyph; low → nothing. Body: bright block, dark glyph. Belly: pale blue block. Marks: navy block with `#`. A few cells shimmer in the accent colours. Deep phase dims everything and drops shimmer; brightness ramps up through the breach.
- **Cost:** masks are built once; per frame only the covered cells are drawn.
- **Failures:** missing folder, image or bad `pack.json` → creature skipped, one console warning, Summon hidden. A cut-out covering over 90% of its image is rejected. On `file://` the browser blocks pixel reads, so creatures need the local server; one console note.
- **Self-checks:** Lugia's cut-out covers 35–60% of its bounding box; all three regions present; the timeline's phases run in order and end off-screen.
- **Browser checks:** summon, then screenshots in deep, breach and flight phases in dark and light; fish scatter; missing pack handled; reduced motion skips appearances.
- **Before commit:** git still ignores `pokemon-pack/`; the public build is unchanged without the pack.
