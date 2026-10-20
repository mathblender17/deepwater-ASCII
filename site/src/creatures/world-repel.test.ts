// The vendored engine uses extensionless imports; run with --unstable-sloppy-imports.
import { assert } from "jsr:@std/assert@1.0.8";
import { SHARK_NODES, World } from "../../../vendor-ascii-sharks/src/world.ts";

function worldWithZone() {
  const w = new World([{ kind: "classic", size: 1 }, { kind: "tiger", size: 0.9 }], 120);
  w.resize(1440, 900, 12, 17);
  const zone = { x: 720, y: 450, r: 405 };
  // Put every shark's whole body through the middle of the zone.
  for (const sh of w.sharks) {
    for (let n = 0; n < SHARK_NODES; n++) {
      sh.nodes[n * 2] = 720 - 150 + n * 15;
      sh.nodes[n * 2 + 1] = 450;
    }
  }
  for (const f of w.fish) { f.x = 720 + (Math.random() - 0.5) * 300; f.y = 450 + (Math.random() - 0.5) * 300; }
  w.repel = [zone];
  return { w, zone };
}

Deno.test("sharks are pushed bodily out of a clear zone within 1.2 s", () => {
  const { w, zone } = worldWithZone();
  for (let i = 0; i < 72; i++) w.step(1 / 60);
  for (const sh of w.sharks) {
    for (let n = 0; n < SHARK_NODES; n++) {
      const d = Math.hypot(sh.nodes[n * 2] - zone.x, sh.nodes[n * 2 + 1] - zone.y);
      assert(d >= zone.r, `${sh.kind} node ${n} still ${Math.round(zone.r - d)}px inside`);
    }
  }
});

Deno.test("fish are pushed out of a clear zone within 1.2 s", () => {
  const { w, zone } = worldWithZone();
  for (let i = 0; i < 72; i++) w.step(1 / 60);
  const inside = w.fish.filter((f) => f.alive && Math.hypot(f.x - zone.x, f.y - zone.y) < zone.r);
  assert(inside.length === 0, `${inside.length} fish still inside`);
});
