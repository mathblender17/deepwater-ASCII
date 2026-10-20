/** Maps a canvas point into a rotated sprite's 0–1 box (u across, v down). */
export function cellToUV(px: number, py: number, s: { x: number; y: number; wPx: number; hPx: number; angle: number }) {
  const dx = px - s.x, dy = py - s.y;
  const cos = Math.cos(-s.angle), sin = Math.sin(-s.angle);
  const lx = dx * cos - dy * sin, ly = dx * sin + dy * cos;
  return { u: lx / s.wPx + 0.5, v: ly / s.hPx + 0.5 };
}
