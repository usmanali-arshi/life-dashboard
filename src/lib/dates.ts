/**
 * Date-only values ("floating dates") vs instants.
 *
 * A task due date is a FLOATING DATE — "Tuesday", full stop. It has no time and
 * no timezone. Google Tasks transmits it as midnight UTC, which is a lie of
 * convenience: 2026-08-25T00:00:00Z means "the 25th", not "8pm on the 24th in
 * New York". Formatting that instant in the user's zone shifts it back a day for
 * anyone west of UTC — which is exactly the bug where a task due Tuesday
 * displayed as Monday.
 *
 * The rule, applied everywhere task dues are read:
 *   - the DUE date is read in UTC (it's a floating date, stored at 00:00Z or 12:00Z)
 *   - TODAY is read in the user's timezone (it's a real instant)
 * Comparing those two day-keys is correct. Mixing the zones is not.
 *
 * Calendar events are the opposite case — they're genuine instants and must be
 * read in the user's zone. That's what lib/tz.ts is for.
 */

/** Day key of a floating due date. Always UTC — see above. */
export function dueDayKey(due: string | Date): string {
  return new Date(due).toLocaleDateString('en-CA', { timeZone: 'UTC' });
}

/** Day key for "now" in the user's zone. */
export function todayKeyIn(tz: string, now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: tz });
}

export function tomorrowKeyIn(tz: string, now = new Date()): string {
  return new Date(+now + 864e5).toLocaleDateString('en-CA', { timeZone: tz });
}

/**
 * Turn a 'YYYY-MM-DD' from a date input into the instant we store.
 *
 * Noon UTC, deliberately: it survives ±12h of zone shifts without the UTC date
 * component changing, so the floating date round-trips no matter where it's
 * read.
 */
export function floatingDateToInstant(ymd: string): Date {
  return new Date(`${ymd.slice(0, 10)}T12:00:00.000Z`);
}

/** 'YYYY-MM-DD' for a date input, from a stored due value. */
export const dueInputValue = (due: string | null): string =>
  due ? dueDayKey(due) : '';
