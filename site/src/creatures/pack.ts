/** Checks one pokemon-pack/pack.json entry before it is loaded, so a typo skips that creature instead of breaking the drawing. */
export function entryProblem(e: { pose?: unknown; head?: unknown; colors?: Record<string, unknown> } & Record<string, unknown>): string | null {
  if (!e.pose && !e.head) return "no pose or head image";
  const body = e.colors?.body;
  if (typeof body !== "string") return "no colors.body";
  for (const [name, value] of Object.entries(e.colors ?? {})) {
    if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) return `colors.${name} is not a #rrggbb colour`;
  }
  return null;
}
