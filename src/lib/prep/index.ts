import { apiDesign } from './sheets/api-design';
import { dbIndexing } from './sheets/db-indexing';
import { dataModeling } from './sheets/data-modeling';
import { deliveryFramework } from './sheets/delivery-framework';
import { stack } from './sheets/stack';
import { slidingWindow } from './sheets/sliding-window';
import type { Sheet, SheetKind } from './types';

/**
 * The registry. Adding a cheat sheet is two lines: a file under `sheets/` and
 * an entry here. Deliberately a hand-maintained array rather than a filesystem
 * glob — the order below is the reading order, and an alphabetical directory
 * listing is not a curriculum.
 */
export const SHEETS: Sheet[] = [
  deliveryFramework,
  apiDesign,
  dataModeling,
  dbIndexing,
  slidingWindow,
  stack,
];

export const KIND_LABEL: Record<SheetKind, string> = {
  design: 'System design',
  pattern: 'Coding pattern',
};

export function getSheet(slug: string): Sheet | undefined {
  return SHEETS.find((s) => s.slug === slug);
}

export function sheetsByKind(kind: SheetKind): Sheet[] {
  return SHEETS.filter((s) => s.kind === kind);
}

/** Every tag in use, deduped, for the index filter row. */
export function allTags(): string[] {
  return [...new Set(SHEETS.flatMap((s) => s.tags))].sort();
}

/** "3 days ago" / "today". Sheets go stale; the index should admit it. */
export function agoLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(`${iso}T00:00:00Z`).getTime()) / 864e5);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'a month ago' : `${months} months ago`;
}

export type { Sheet, SheetKind, DesignSheet, PatternSheet } from './types';
