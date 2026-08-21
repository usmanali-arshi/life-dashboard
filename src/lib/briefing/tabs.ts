import { dayKeyIn, minutesIn } from '../tz';

/**
 * Per-tab briefs.
 *
 * Same philosophy as the daily briefing (§2): deterministic templates, no LLM,
 * no cost, testable. The bar each line has to clear is that it says something
 * you could NOT get by glancing at the list underneath — a next action, an
 * outlier, a conflict. "You have 5 tasks" is worthless when five tasks are
 * visible below it; "clear the 2 overdue first, both from Cornell" is not.
 *
 * Returning null is a valid, common answer. A brief that appears when there's
 * nothing to say trains people to stop reading it.
 */

export interface Brief { headline: string; body?: string; }

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/* ------------------------------------------------------------------ tasks */

interface TaskLike {
  title: string;
  due: string | null;
  linked_accounts?: { label: string | null; email: string } | null;
  project_name?: string | null;
}

export function tasksBrief(t: {
  overdue: TaskLike[]; dueToday: TaskLike[]; tomorrow: TaskLike[];
  later: TaskLike[]; unscheduled: TaskLike[]; doneToday: number;
}): Brief | null {
  const { overdue, dueToday, tomorrow, unscheduled, doneToday } = t;

  if (!overdue.length && !dueToday.length && !tomorrow.length
      && !unscheduled.length && !t.later.length) {
    return doneToday > 0
      ? { headline: `All clear — ${plural(doneToday, 'task')} done today.` }
      : { headline: 'No open tasks.' };
  }

  const parts: string[] = [];
  let headline: string;

  if (overdue.length) {
    headline = `Clear ${plural(overdue.length, 'overdue task')} first`;
    // Naming the oldest one turns a count into a next action.
    const oldest = [...overdue].sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''))[0];
    if (oldest) parts.push(`Oldest is "${oldest.title}".`);
    if (dueToday.length) parts.push(`Then ${plural(dueToday.length, 'task')} due today.`);
  } else if (dueToday.length) {
    headline = `${plural(dueToday.length, 'task')} due today`;
    parts.push(dueToday.length > 4
      ? 'A lot for one day — consider pushing the softer ones to tomorrow.'
      : `Starting with "${dueToday[0].title}".`);
  } else if (tomorrow.length) {
    headline = 'Nothing due today';
    parts.push(`${plural(tomorrow.length, 'task')} lands tomorrow — a good time to get ahead.`);
  } else {
    headline = 'Nothing due today or tomorrow';
  }

  if (doneToday) parts.push(`${plural(doneToday, 'task')} already done today.`);

  // An unscheduled pile is worth flagging only once it's big enough to be a
  // backlog rather than a couple of loose ends.
  if (unscheduled.length >= 5) {
    parts.push(`${unscheduled.length} tasks have no date — worth scheduling or dropping.`);
  }

  return { headline, body: parts.join(' ') };
}

/* --------------------------------------------------------------- calendar */

interface EventLike {
  title: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  linked_accounts?: { label: string | null; email: string } | null;
}

export function calendarBrief(events: EventLike[], tz: string): Brief | null {
  const timed = events.filter((e) => !e.all_day);
  if (!timed.length) return { headline: 'Nothing scheduled this week.' };

  const byDay = new Map<string, EventLike[]>();
  let totalMinutes = 0;
  for (const e of timed) {
    const key = dayKeyIn(e.starts_at, tz);
    byDay.set(key, [...(byDay.get(key) ?? []), e]);
    totalMinutes += Math.max(0, (+new Date(e.ends_at) - +new Date(e.starts_at)) / 60000);
  }

  const busiest = [...byDay.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  const busiestName = new Date(`${busiest[0]}T12:00:00Z`)
    .toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });

  // Overlaps across all connected calendars — the single most useful thing a
  // merged view can tell you, and invisible in any one account.
  let conflicts = 0;
  const sorted = [...timed].sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
  for (let i = 0; i < sorted.length - 1; i++) {
    if (+new Date(sorted[i].ends_at) > +new Date(sorted[i + 1].starts_at)) conflicts++;
  }

  const hours = Math.round(totalMinutes / 60);
  const free = [...byDay.keys()];
  const emptyDays = 7 - free.length;

  const parts = [
    `${plural(busiest[1].length, 'meeting')} on ${busiestName} — the heaviest day.`,
  ];
  if (conflicts) {
    parts.push(`⚠ ${plural(conflicts, 'overlap')} across your calendars.`);
  }
  if (emptyDays > 0) parts.push(`${plural(emptyDays, 'day')} completely clear.`);

  return {
    headline: `${plural(timed.length, 'meeting')} this week, about ${hours}h in total`,
    body: parts.join(' '),
  };
}

/* ------------------------------------------------------------------ inbox */

interface ThreadLike {
  subject: string | null;
  from_name: string | null;
  from_email: string | null;
  last_message_at: string;
  needs_reply: boolean;
  is_unread: boolean;
}

export function inboxBrief(t: { needsReply: ThreadLike[]; unread: ThreadLike[]; all: ThreadLike[] }): Brief | null {
  if (!t.all.length) return { headline: 'Nothing in the last 7 days.' };

  if (!t.needsReply.length) {
    return {
      headline: t.unread.length
        ? `${plural(t.unread.length, 'unread thread')}, none obviously needing a reply`
        : 'Inbox is clear.',
    };
  }

  const oldest = [...t.needsReply]
    .sort((a, b) => a.last_message_at.localeCompare(b.last_message_at))[0];
  const ageDays = Math.floor((Date.now() - +new Date(oldest.last_message_at)) / 864e5);

  const parts: string[] = [];
  const who = oldest.from_name ?? oldest.from_email ?? 'someone';
  parts.push(ageDays >= 1
    ? `Longest waiting: ${who}, ${plural(ageDays, 'day')} ago — "${oldest.subject ?? 'no subject'}".`
    : `Oldest is from ${who} earlier today.`);

  // Repeat senders are usually the thing actually blocking someone.
  const counts = new Map<string, number>();
  for (const th of t.needsReply) {
    const k = th.from_name ?? th.from_email ?? 'unknown';
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const repeat = [...counts.entries()].filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1])[0];
  if (repeat) parts.push(`${repeat[0]} is waiting on ${repeat[1]} threads.`);

  return {
    headline: `${plural(t.needsReply.length, 'thread')} waiting on you`,
    body: parts.join(' '),
  };
}

/* ----------------------------------------------------------------- habits */

export function habitsBrief(habits: { name: string; doneToday: boolean; streak: number }[]): Brief | null {
  if (!habits.length) return null;

  const done = habits.filter((h) => h.doneToday);
  const pending = habits.filter((h) => !h.doneToday);
  const best = [...habits].sort((a, b) => b.streak - a.streak)[0];

  const parts: string[] = [];
  if (best?.streak >= 3) parts.push(`Longest run: ${best.name}, ${plural(best.streak, 'day')}.`);
  // A streak you're about to break is the one piece of information that can
  // still change the outcome today.
  const atRisk = pending.filter((h) => h.streak >= 3).map((h) => h.name);
  if (atRisk.length) {
    parts.push(`${atRisk.join(' and ')} — don't break the streak.`);
  }

  return {
    headline: done.length === habits.length
      ? 'Everything logged today.'
      : `${done.length} of ${habits.length} logged today`,
    body: parts.join(' '),
  };
}
