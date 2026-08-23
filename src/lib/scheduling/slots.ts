import { addDays, dayKeyIn, minutesIn } from '../tz';

/**
 * Free-slot finder over a multi-day horizon.
 *
 * This is deliberately NOT the LLM's job. An LLM asked to subtract meetings from
 * a day will confidently produce a slot that overlaps your 3pm — and you won't
 * notice until you miss it. So the arithmetic happens here, exactly once, and
 * the model only ever receives a list of gaps that are already true.
 *
 * Rules encoded:
 *  - overlapping meetings merge (double-booked hour blocks one hour, not two)
 *  - events crossing midnight clip at the day boundary
 *  - all-day events don't block time (they're context, not occupancy)
 *  - gaps shorter than MIN_SLOT aren't slots, they're transitions
 *  - today starts from now, not from waking hours in the past
 */

const DAY_START = 8 * 60;    // 08:00
const DAY_END = 22 * 60;     // 22:00
const MIN_SLOT = 30;
/** Breathing room either side of a meeting — nobody starts the gym 60 seconds
 *  after a call ends. */
const BUFFER = 10;

export interface Slot {
  dayKey: string;       // 'YYYY-MM-DD'
  startMin: number;     // minutes from local midnight
  endMin: number;
  minutes: number;
}

export interface DaySlots {
  dayKey: string;
  weekday: string;
  slots: Slot[];
  freeMinutes: number;
  meetingCount: number;
  busyMinutes: number;
}

interface Ev {
  title: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  status?: string | null;
}

export function findSlots(
  events: Ev[], tz: string, days = 8, now = new Date(),
): DaySlots[] {
  // Derive the horizon from the `now` we were given, not from the system clock.
  // Ignoring the parameter made the function untestable and would have desynced
  // the horizon from the caller's clock.
  const start = dayKeyIn(now, tz);
  const nowMin = minutesIn(now, tz);
  const out: DaySlots[] = [];

  for (let d = 0; d < days; d++) {
    const dayKey = addDays(start, d);
    const isToday = d === 0;

    const busy = events
      .filter((e) => !e.all_day
        && e.status !== 'cancelled'
        && dayKeyIn(e.starts_at, tz) === dayKey)
      .map((e) => {
        const s = minutesIn(e.starts_at, tz);
        const raw = dayKeyIn(e.ends_at, tz) === dayKey ? minutesIn(e.ends_at, tz) : 24 * 60;
        return {
          start: Math.max(0, s - BUFFER),
          end: Math.min(24 * 60, Math.max(raw, s + 15) + BUFFER),
        };
      })
      .sort((a, b) => a.start - b.start);

    // Merge overlaps before subtracting, or two double-booked calls would
    // consume twice the wall-clock they actually occupy.
    const merged: { start: number; end: number }[] = [];
    for (const b of busy) {
      const last = merged[merged.length - 1];
      if (last && b.start <= last.end) last.end = Math.max(last.end, b.end);
      else merged.push({ ...b });
    }

    const from = isToday ? Math.max(nowMin, DAY_START) : DAY_START;
    const slots: Slot[] = [];
    let cursor = from;

    const push = (s: number, e: number) => {
      const mins = Math.min(e, DAY_END) - Math.max(s, from);
      if (mins >= MIN_SLOT) {
        slots.push({
          dayKey,
          startMin: Math.max(s, from),
          endMin: Math.min(e, DAY_END),
          minutes: mins,
        });
      }
    };

    for (const b of merged) {
      if (b.start > cursor) push(cursor, b.start);
      cursor = Math.max(cursor, b.end);
      if (cursor >= DAY_END) break;
    }
    if (cursor < DAY_END) push(cursor, DAY_END);

    const busyMinutes = merged.reduce(
      (n, b) => n + Math.max(0, Math.min(b.end, DAY_END) - Math.max(b.start, from)), 0);

    out.push({
      dayKey,
      weekday: new Date(`${dayKey}T12:00:00Z`)
        .toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }),
      slots,
      freeMinutes: slots.reduce((n, s) => n + s.minutes, 0),
      meetingCount: merged.length,
      busyMinutes,
    });
  }

  return out;
}

export interface Activity {
  name: string;
  duration_minutes: number;
  earliest_hour?: number | null;
  latest_hour?: number | null;
  days_of_week?: number[] | null;
}

export interface Fit {
  activity: string;
  dayKey: string;
  weekday: string;
  startMin: number;
  endMin: number;
  slack: number;      // spare minutes in the chosen slot
}

/**
 * First N places an activity actually fits, honouring its time-of-day window
 * and allowed weekdays. Earliest-first, because "when can I" almost always
 * means "how soon can I".
 */
export function fitActivity(
  days: DaySlots[], activity: Activity, limit = 5,
): Fit[] {
  const fits: Fit[] = [];
  const lo = (activity.earliest_hour ?? 0) * 60;
  const hi = (activity.latest_hour ?? 24) * 60;
  const allowedDays = activity.days_of_week?.length ? activity.days_of_week : null;

  for (const day of days) {
    if (allowedDays) {
      const dow = new Date(`${day.dayKey}T12:00:00Z`).getUTCDay();
      if (!allowedDays.includes(dow)) continue;
    }
    for (const slot of day.slots) {
      // Intersect the free gap with the activity's acceptable window.
      const start = Math.max(slot.startMin, lo);
      const end = Math.min(slot.endMin, hi);
      const usable = end - start;
      if (usable < activity.duration_minutes) continue;

      fits.push({
        activity: activity.name,
        dayKey: day.dayKey,
        weekday: day.weekday,
        startMin: start,
        endMin: start + activity.duration_minutes,
        slack: usable - activity.duration_minutes,
      });
      if (fits.length >= limit) return fits;
      break;   // one suggestion per day keeps the answer scannable
    }
  }
  return fits;
}

export const clock = (mins: number): string => {
  const h = Math.floor(mins / 60), m = mins % 60;
  const ampm = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`;
};

export const hhmm = (mins: number): string => {
  const h = Math.floor(mins / 60), m = Math.round(mins % 60);
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
};
