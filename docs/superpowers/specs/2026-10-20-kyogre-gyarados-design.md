# Kyogre and Gyarados — design

Date: 2026-10-20 · Status: approved in chat · Builds on: `2026-10-20-lugia-ocean-appearance-design.md`

## Goal

Two more ocean creatures, each with its own way of appearing, using the circle language that made Lugia work (see the user's taste note: build-up first, hidden until the reveal, gentle, never in the face).

## Kyogre — "the leap" (legendary, ~9.2 s)

1. **Circle A forms** (3 s) at a point in the middle band of the screen: dot → full circle, teal inside, soft rim, clear gap travelling with the edge.
2. **Surfaces** (0.6 s): Kyogre swells up out of A (surfacing pose) with foam rings.
3. **Leaps** (1.6 s) to a point P2 about 0.4 of the screen width away (left or right, slight vertical offset), turned to face its travel. It grows mid-leap (peak ≈ 1.4× its surfacing size), then shrinks and dims as it noses down. **Circle B** opens at P2 from the start of the surfacing so it is fully open at landing; **circle A** closes over the leap.
4. **Dives into B**: foam rings at P2.
5. **Stays** (2.5 s): a dim shape (≈35% brightness) inside B, under the sharks, turning slowly.
6. **Goes deep** (1.5 s): it shrinks and fades while B closes to a dot.

Kyogre's circles are 0.75× Lugia's.

## Gyarados — "the swivel" (visitor, ~8.5 s)

1. **Circle A forms** (2.5 s) at x 15–25%, y 55–75% of the screen.
2. **Bursts out and swivels** (4.8 s): the head leaves A and travels an S-curve diagonally to **circle B** at x 65–80%, y 20–35%; the whole body follows the same curve behind the head. Parts of the body still "before" A or "past" B are under water (not drawn). B opens while the head is past the curve's midpoint; A closes once the tail has left it.
3. **Dives** : the head enters B and the body follows it in segment by segment; B closes (1.2 s) once the tail is in.

Body: a spine of ~24 nodes, ~70 cells long, placed along the curve behind the head (stateless: node k sits at path parameter u_head − k·Δu). Drawn as a thick tapering band of cells: teal back, a cream band of belly plates on one side, white fin spikes every few segments. The head is cut from `garados side view.webp` (crop given in `pack.json`) and drawn rotated to the direction of travel. Gyarados's circles are 0.45× Lugia's.

## Shared changes

- **`pack.json`** lists all creatures. Per creature: `role` (legendary | visitor), `motion` (rise | leap | swivel), images (`pose`, optional `breach`, or `head` + `headCrop`), optional `facing` (degrees the image faces), optional `palette` (source colour → region), and `colors` (region → paint colour).
- **Regions**: body, belly, marks, fin. With a `palette`, each pixel takes the region of its nearest source colour. Without one (Lugia), the existing tested rules stay — Lugia is unchanged.
- **Rotation**: sprites carry an angle; sampling maps each cell back into the image.
- **Scenes**: each motion is a pure function of time returning a scene — circles (centre, radius, tint), foam rings, an optional sprite, an optional serpent, and extra clear zones (flight path). The water draws every circle and foam ring; clear zones are every circle plus the 6-cell gap, plus the path.
- **Who appears**: one at a time; Gyarados 50%, Lugia 25%, Kyogre 25%; first after 8–12 s, then every 25–45 s.
- **Tune**: the Legendaries group becomes **Summon** with one button per loaded creature.
- Missing images for one creature skip only that creature.

## Testing

Unit tests (Deno) first for: palette labelling and rotated sampling; each motion's phase order, visibility, circle open/close timing and end state; the serpent's even spacing, following the head, and hiding parts before A / past B; clear zones; the creature picker's weights. Then headless-Chrome screenshots of every step in dark and light.
