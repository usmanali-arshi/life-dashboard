import { clock, hhmm, type Activity, type DaySlots, fitActivity } from './slots';

/**
 * The deterministic half of the assistant.
 *
 * Builds (a) a compact factual context for the model and (b) a complete answer
 * that stands on its own when no LLM key is configured. Every number in both
 * comes from findSlots() — the model is never asked to do arithmetic, only to
 * read a sentence and pick from options that are already correct.
 */

export interface TaskLite {
  title: string;
  due: string | null;
  bucket: 'overdue' | 'today' | 'tomorrow' | 'later' | 'unscheduled';
  account?: string | null;
}

export interface Context {
  now: Date;
  tz: string;
  days: DaySlots[];
  activities: Activity[];
  tasks: TaskLite[];
}

/** Match an activity by name, tolerantly — "gym" should find "Gym". */
export function matchActivities(text: string, activities: Activity[]): Activity[] {
  const q = text.toLowerCase();
  const hits = activities.filter((a) => {
    const name = a.name.toLowerCase();
    if (q.includes(name)) return true;
    // Also match on the distinctive words of a multi-word name, so "groceries"
    // finds "Groceries in the city".
    return name.split(/\s+/).filter((w) => w.length > 4).some((w) => q.includes(w));
  });
  return hits;
}

/** "2 hours", "90 min", "an hour and a half" → minutes. */
export function parseDuration(text: string): number | null {
  const t = text.toLowerCase();
  let total = 0;
  const h = t.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)/);
  const m = t.match(/(\d+)\s*(?:m|min|mins|minute|minutes)/);
  if (h) total += parseFloat(h[1]) * 60;
  if (m) total += parseInt(m[1], 10);
  if (!total && /\bhalf an hour\b/.test(t)) total = 30;
  if (!total && /\ban hour and a half\b/.test(t)) total = 90;
  if (!total && /\ban hour\b/.test(t)) total = 60;
  return total || null;
}

export function buildLlmContext(ctx: Context): string {
  const lines: string[] = [];

  lines.push(`Today is ${ctx.now.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: ctx.tz,
  })}. Local time is ${ctx.now.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: ctx.tz,
  })} (${ctx.tz}).`);

  lines.push('\nFREE SLOTS (already computed — these are authoritative, do not recalculate):');
  for (const d of ctx.days) {
    if (!d.slots.length) {
      lines.push(`${d.weekday} ${d.dayKey}: nothing free (${d.meetingCount} meetings)`);
      continue;
    }
    const parts = d.slots.map((s) => `${clock(s.startMin)}–${clock(s.endMin)} (${hhmm(s.minutes)})`);
    lines.push(`${d.weekday} ${d.dayKey}: ${hhmm(d.freeMinutes)} free across `
      + `${d.slots.length} gap${d.slots.length > 1 ? 's' : ''} — ${parts.join(', ')}`
      + ` · ${d.meetingCount} meeting${d.meetingCount === 1 ? '' : 's'}`);
  }

  if (ctx.activities.length) {
    lines.push('\nACTIVITIES the user might schedule (name, duration, allowed hours):');
    for (const a of ctx.activities) {
      const window = a.earliest_hour != null || a.latest_hour != null
        ? `, between ${a.earliest_hour ?? 0}:00 and ${a.latest_hour ?? 24}:00` : '';
      lines.push(`- ${a.name}: ${hhmm(a.duration_minutes)}${window}`);
    }
  }

  const open = ctx.tasks.filter((t) => t.bucket !== 'unscheduled' && t.bucket !== 'later');
  if (open.length) {
    lines.push('\nTASKS competing for that time:');
    for (const t of open.slice(0, 25)) {
      lines.push(`- [${t.bucket}] ${t.title}${t.account ? ` (${t.account})` : ''}`);
    }
  }
  const undated = ctx.tasks.filter((t) => t.bucket === 'unscheduled').length;
  if (undated) lines.push(`(plus ${undated} undated tasks)`);

  return lines.join('\n');
}

export const SYSTEM_PROMPT = `You help someone decide whether an activity fits into their real schedule.

You are given pre-computed free slots. They are authoritative and already account for meetings across all their calendars, merged overlaps, and a 10-minute buffer around each meeting. NEVER recompute or second-guess them, and never invent a slot that isn't listed.

How to answer:
- Lead with a direct yes or no, then the specific day and time.
- Name real days and clock times ("Thursday 2:30–4pm"), never vague ones.
- Offer at most 3 options. More is not more helpful.
- Weigh the tasks against the free time honestly. If someone has 4 overdue tasks and one 2-hour gap, say that spending it on board games has a cost — briefly, once, without lecturing.
- If an activity has no duration given, estimate one and say you estimated it.
- If nothing fits, say so plainly and name the nearest thing that would fit, or what they'd have to move.
- Two to four sentences. No headers, no bullet lists, no preamble.

You cannot create calendar events. If asked to book something, say it has to be added in Google Calendar for now.`;

/**
 * Full answer with no LLM. Used when no key is configured, and as the fallback
 * when a provider call fails.
 */
export function deterministicAnswer(question: string, ctx: Context): string {
  const explicit = parseDuration(question);
  const named = matchActivities(question, ctx.activities);

  const targets: Activity[] = named.length
    ? named
    : explicit
      ? [{ name: `${hhmm(explicit)} block`, duration_minutes: explicit }]
      : [];

  const totalFree = ctx.days.reduce((n, d) => n + d.freeMinutes, 0);
  const todayFree = ctx.days[0]?.freeMinutes ?? 0;
  const overdue = ctx.tasks.filter((t) => t.bucket === 'overdue').length;
  const dueToday = ctx.tasks.filter((t) => t.bucket === 'today').length;

  if (!targets.length) {
    const best = [...ctx.days].sort((a, b) => b.freeMinutes - a.freeMinutes)[0];
    return [
      `You have ${hhmm(todayFree)} free today and ${hhmm(totalFree)} across the next week.`,
      best ? `${best.weekday} is your most open day at ${hhmm(best.freeMinutes)}.` : '',
      overdue || dueToday
        ? `${overdue} overdue and ${dueToday} due today are competing for it.`
        : '',
      'Name an activity or a duration and I\'ll tell you exactly where it fits.',
    ].filter(Boolean).join(' ');
  }

  const parts: string[] = [];
  for (const t of targets.slice(0, 2)) {
    const fits = fitActivity(ctx.days, t, 3);
    if (!fits.length) {
      parts.push(`${t.name} (${hhmm(t.duration_minutes)}) doesn't fit anywhere in the next week `
        + `within its usual hours.`);
      continue;
    }
    const first = fits[0];
    const others = fits.slice(1)
      .map((f) => `${f.weekday} ${clock(f.startMin)}`).join(', ');
    parts.push(`Yes — ${t.name} fits ${first.dayKey === ctx.days[0].dayKey ? 'today' : first.weekday} `
      + `${clock(first.startMin)}–${clock(first.endMin)}`
      + `${first.slack >= 30 ? `, with ${hhmm(first.slack)} to spare` : ''}.`
      + (others ? ` Also possible: ${others}.` : ''));
  }

  if (overdue >= 2) {
    parts.push(`Worth knowing you have ${overdue} overdue tasks.`);
  }

  return parts.join(' ');
}
