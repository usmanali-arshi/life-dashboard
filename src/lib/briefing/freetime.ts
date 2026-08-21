import { dayKeyIn, minutesIn } from '../tz';

/**
 * How much of today is actually unclaimed, and what fits in it.
 *
 * The useful number is not "24 minus meetings" — it's how much usable time is
 * left between now and the end of your day. A 9am start is irrelevant at 4pm.
 */

const DAY_START = 8 * 60;   // 08:00
const DAY_END = 22 * 60;    // 22:00
/** Gaps shorter than this aren't usable for anything, so they don't count. */
const MIN_USABLE = 20;

export interface FreeTime {
  freeMinutes: number;
  /** Largest single uninterrupted stretch remaining. */
  largest: { startMin: number; minutes: number } | null;
  nextMeeting: { title: string; startMin: number } | null;
  remainingMeetings: number;
  dayOver: boolean;
}

interface Ev {
  title: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  status?: string | null;
}

export function freeTimeToday(events: Ev[], tz: string, now = new Date()): FreeTime {
  const today = dayKeyIn(now, tz);
  const nowMin = minutesIn(now, tz);
  const from = Math.max(nowMin, DAY_START);

  if (from >= DAY_END) {
    return { freeMinutes: 0, largest: null, nextMeeting: null, remainingMeetings: 0, dayOver: true };
  }

  // Merge overlapping meetings first — two double-booked calls block one hour,
  // not two, and counting them twice would understate free time.
  const busy = events
    .filter((e) => !e.all_day && e.status !== 'cancelled' && dayKeyIn(e.starts_at, tz) === today)
    .map((e) => ({
      title: e.title ?? 'Untitled',
      start: minutesIn(e.starts_at, tz),
      end: dayKeyIn(e.ends_at, tz) === today ? minutesIn(e.ends_at, tz) : DAY_END,
    }))
    .filter((b) => b.end > from)
    .sort((a, b) => a.start - b.start);

  const merged: { start: number; end: number }[] = [];
  for (const b of busy) {
    const last = merged[merged.length - 1];
    if (last && b.start <= last.end) last.end = Math.max(last.end, b.end);
    else merged.push({ start: b.start, end: b.end });
  }

  let free = 0;
  let largest: FreeTime['largest'] = null;
  let cursor = from;

  const consider = (start: number, end: number) => {
    const mins = end - start;
    if (mins < MIN_USABLE) return;
    free += mins;
    if (!largest || mins > largest.minutes) largest = { startMin: start, minutes: mins };
  };

  for (const b of merged) {
    if (b.start > cursor) consider(cursor, Math.min(b.start, DAY_END));
    cursor = Math.max(cursor, b.end);
    if (cursor >= DAY_END) break;
  }
  if (cursor < DAY_END) consider(cursor, DAY_END);

  const upcoming = busy.filter((b) => b.start > nowMin).sort((a, b) => a.start - b.start)[0];

  return {
    freeMinutes: free,
    largest,
    nextMeeting: upcoming ? { title: upcoming.title, startMin: upcoming.start } : null,
    remainingMeetings: busy.length,
    dayOver: false,
  };
}

export function formatMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatClock(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`;
}

/**
 * What the remaining time is realistically good for. Deliberately concrete —
 * "4h 20m free" is a number; "enough for 3 of today's tasks, and one 90-minute
 * deep-work block" is a plan.
 */
export function whatFits(free: FreeTime, openTasksToday: number): string {
  if (free.dayOver) return 'The day is done. Anything left is tomorrow’s problem.';
  if (free.freeMinutes < 30) {
    return 'Almost nothing free — today is meetings. Protect tomorrow instead.';
  }

  const parts: string[] = [];

  if (free.largest) {
    const l = free.largest;
    const kind = l.minutes >= 120 ? 'deep work'
      : l.minutes >= 60 ? 'one focused block'
      : 'a quick pass';
    parts.push(`Longest stretch is ${formatMins(l.minutes)} from ${formatClock(l.startMin)} — good for ${kind}.`);
  }

  if (openTasksToday > 0) {
    // ~35 min per task is a deliberately conservative planning estimate; the
    // point is to be honest about capacity, not optimistic.
    const capacity = Math.floor(free.freeMinutes / 35);
    parts.push(capacity >= openTasksToday
      ? `Enough room for all ${openTasksToday} of today's tasks.`
      : capacity === 0
        ? 'Not really enough for any of today’s tasks — pick one and cut the rest.'
        : `Realistically about ${capacity} of your ${openTasksToday} tasks today.`);
  }

  if (free.nextMeeting) {
    parts.push(`Next up: ${free.nextMeeting.title} at ${formatClock(free.nextMeeting.startMin)}.`);
  }

  return parts.join(' ');
}
