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

export const INDUSTRY_COLORS = 10;

/**
 * One colour slot per industry, distinct while there are slots to spare. Each
 * industry's preferred slot comes from its id hash, so colours are stable;
 * collisions walk to the next free slot in id order, so adding an industry
 * only ever recolours the one that collided.
 */
export function industryColors(ids: string[]): Map<string, number> {
  const out = new Map<string, number>();
  const taken = new Set<number>();
  for (const id of [...ids].sort()) {
    let slot = hash(id + 'i') % INDUSTRY_COLORS;
    if (taken.size < INDUSTRY_COLORS) {
      while (taken.has(slot)) slot = (slot + 1) % INDUSTRY_COLORS;
    }
    taken.add(slot);
    out.set(id, slot + 1);
  }
  return out;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '?';
}
