/**
 * In light mode the page shows the canvas through `invert(1) hue-rotate(180deg)`.
 * Painting forLightCanvas(c) makes the viewer see c. The 180° hue-rotate matrix is
 * its own inverse (2·luma − identity), so applying it once and inverting undoes both.
 */
export function forLightCanvas([r, g, b]: [number, number, number]): [number, number, number] {
  const rot = [
    -0.574 * r + 1.43 * g + 0.144 * b,
    0.426 * r + 0.43 * g + 0.144 * b,
    0.426 * r + 1.43 * g - 0.856 * b,
  ];
  return rot.map((v) => 255 - Math.max(0, Math.min(255, Math.round(v)))) as [number, number, number];
}
