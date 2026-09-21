/** Deterministic per-contact visuals: same id → same tint and tilt on every render. */

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export const TINTS = 6;

export const tintIndex = (id: string) => (hash(id) % TINTS) + 1;

/** ±2°, in 0.25° steps. */
export const rotation = (id: string) => ((hash(id + 'r') % 17) - 8) * 0.25;

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '?';
}
