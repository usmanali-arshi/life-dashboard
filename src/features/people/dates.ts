/**
 * met_on is a floating date ('YYYY-MM-DD'). Everything here formats it via
 * UTC so it never shifts a day for users west of UTC — same rule as lib/dates.ts.
 */

const utc = (ymd: string) => {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

/** "Sep 12" */
export const fmtMetOn = (ymd: string) =>
  utc(ymd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** "Sep 12, 2026" */
export const fmtMetOnLong = (ymd: string) =>
  utc(ymd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** 'YYYY-MM' */
export const monthKey = (ymd: string) => ymd.slice(0, 7);

/** "September 2026" from a 'YYYY-MM' key. */
export const fmtMonth = (ym: string) =>
  utc(`${ym}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Local floating date for "today" ± n days, from the browser's zone. */
export const localDayKey = (offsetDays = 0) =>
  new Date(Date.now() + offsetDays * 864e5).toLocaleDateString('en-CA');
