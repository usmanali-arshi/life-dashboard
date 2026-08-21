/**
 * Timezone helpers.
 *
 * Everything in the DB is a UTC instant. The calendar has to lay events out in
 * the *user's* zone, and doing that with the server's local time is the classic
 * way to get events one row off for half the year. These convert an instant to
 * wall-clock parts in a named zone without pulling in a date library.
 */

export interface Parts { y: number; m: number; d: number; h: number; min: number; }

const cache = new Map<string, Intl.DateTimeFormat>();

function fmt(tz: string): Intl.DateTimeFormat {
  let f = cache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
    cache.set(tz, f);
  }
  return f;
}

export function partsIn(date: Date | string, tz: string): Parts {
  const p = fmt(tz).formatToParts(new Date(date));
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  // Intl renders midnight as hour 24 in some locales under hour12:false.
  const h = get('hour') % 24;
  return { y: get('year'), m: get('month'), d: get('day'), h, min: get('minute') };
}

/** 'YYYY-MM-DD' for the calendar day this instant falls on, in tz. */
export function dayKeyIn(date: Date | string, tz: string): string {
  const { y, m, d } = partsIn(date, tz);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Minutes since local midnight, in tz. */
export function minutesIn(date: Date | string, tz: string): number {
  const { h, min } = partsIn(date, tz);
  return h * 60 + min;
}

/** The UTC instant of local midnight on a 'YYYY-MM-DD' in tz. */
export function startOfDayUTC(dayKey: string, tz: string): Date {
  const [y, m, d] = dayKey.split('-').map(Number);
  // Guess, then correct by the offset the guess actually lands on. Two passes
  // is enough for every real zone, including DST boundaries.
  let guess = Date.UTC(y, m - 1, d, 0, 0);
  for (let i = 0; i < 2; i++) {
    const p = partsIn(new Date(guess), tz);
    const drift =
      (Date.UTC(p.y, p.m - 1, p.d, p.h, p.min) - Date.UTC(y, m - 1, d, 0, 0));
    guess -= drift;
  }
  return new Date(guess);
}

export function addDays(dayKey: string, n: number): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** Monday-based week start for the day containing `dayKey`. */
export function weekStart(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun
  return addDays(dayKey, dow === 0 ? -6 : 1 - dow);
}

export function todayKey(tz: string): string {
  return dayKeyIn(new Date(), tz);
}
