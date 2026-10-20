/** Maps a canvas point into a rotated sprite's 0–1 box (u across, v down); `flip` mirrors the image left to right. */
export function cellToUV(px: number, py: number, s: { x: number; y: number; wPx: number; hPx: number; angle: number; flip?: boolean }) {
  const dx = px - s.x, dy = py - s.y;
  const cos = Math.cos(-s.angle), sin = Math.sin(-s.angle);
  const lx = dx * cos - dy * sin, ly = dx * sin + dy * cos;
  const u = lx / s.wPx + 0.5;
  return { u: s.flip ? 1 - u : u, v: ly / s.hPx + 0.5 };
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * How to show an image that faces `facing` so it points along `angle` and stays upright:
 * mirroring it makes it face π − facing, so pick whichever needs the smaller turn.
 */
export function orient(angle: number, facing: number): { rot: number; flip: boolean } {
  const plain = wrap(angle - facing), mirrored = wrap(angle - (Math.PI - facing));
  return Math.abs(mirrored) < Math.abs(plain) ? { rot: mirrored, flip: true } : { rot: plain, flip: false };
}
