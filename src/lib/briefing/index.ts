import {
  describeCode, dressAdvice, formatTemp, type TempUnit, type WeatherToday,
} from '../providers/weather';

/**
 * The swap point. Ship the template generator, and the day prose is worth
 * paying for, add ClaudeBriefingGenerator implementing this same interface and
 * flip an env var. No caller changes.
 *
 * Cost reasoning behind starting with the template: Claude Haiku is ~$0.25/mo
 * for one user but ~$180/mo at 1,000 daily users. Defer until we know users
 * value it. See architecture.md section 2.
 */
export interface BriefingInput {
  now: Date;
  timezone: string;
  events: { title: string | null; startsAt: Date; endsAt: Date; allDay: boolean; accountLabel: string }[];
  needsReply: { subject: string | null; fromName: string | null }[];
  unreadCount: number;
  tasksDueToday: { title: string }[];
  tasksOverdue: { title: string }[];
  weather: WeatherToday | null;
  tempUnit?: TempUnit;
  habitsPending: string[];
}

export interface Briefing {
  headline: string;
  body: string;
  generator: 'template' | 'claude';
}

export interface BriefingGenerator {
  readonly id: 'template' | 'claude';
  generate(input: BriefingInput): Promise<Briefing>;
}

const fmtTime = (d: Date, tz: string) =>
  d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });

/** Largest uninterrupted gap between 9am and 6pm — the "when can I actually work" answer. */
function findFocusBlock(events: BriefingInput['events'], now: Date, tz: string): string | null {
  const timed = events.filter((e) => !e.allDay && e.endsAt > now).sort((a, b) => +a.startsAt - +b.startsAt);
  if (!timed.length) return null;

  const dayEnd = new Date(now);
  dayEnd.setHours(18, 0, 0, 0);
  let cursor = now;
  let best: { start: Date; mins: number } | null = null;

  for (const e of timed) {
    const gap = (+e.startsAt - +cursor) / 60000;
    if (gap >= 45 && (!best || gap > best.mins)) best = { start: cursor, mins: gap };
    if (e.endsAt > cursor) cursor = e.endsAt;
  }
  const tail = (+dayEnd - +cursor) / 60000;
  if (tail >= 45 && (!best || tail > best.mins)) best = { start: cursor, mins: tail };

  if (!best) return null;
  const h = Math.floor(best.mins / 60);
  const m = Math.round(best.mins % 60);
  const dur = h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
  return `${dur} free from ${fmtTime(best.start, tz)}`;
}

/** Overlapping timed events across all connected calendars. */
function findConflicts(events: BriefingInput['events']): string[] {
  const timed = events.filter((e) => !e.allDay).sort((a, b) => +a.startsAt - +b.startsAt);
  const out: string[] = [];
  for (let i = 0; i < timed.length - 1; i++) {
    if (timed[i].endsAt > timed[i + 1].startsAt) {
      out.push(`${timed[i].title ?? 'Untitled'} overlaps ${timed[i + 1].title ?? 'Untitled'}`);
    }
  }
  return out;
}

export const templateGenerator: BriefingGenerator = {
  id: 'template',

  async generate(i: BriefingInput): Promise<Briefing> {
    const tz = i.timezone;
    const upcoming = i.events.filter((e) => e.endsAt > i.now);
    const meetings = upcoming.filter((e) => !e.allDay);

    const headline = meetings.length === 0
      ? 'No meetings today — the calendar is yours'
      : meetings.length === 1
        ? `One meeting today, ${fmtTime(meetings[0].startsAt, tz)}`
        : `${meetings.length} meetings today, first at ${fmtTime(meetings[0].startsAt, tz)}`;

    const lines: string[] = [];

    if (meetings.length) {
      const last = meetings[meetings.length - 1];
      lines.push(`Calendar runs ${fmtTime(meetings[0].startsAt, tz)} to ${fmtTime(last.endsAt, tz)}.`);
      const focus = findFocusBlock(upcoming, i.now, tz);
      if (focus) lines.push(`Best focus block: ${focus}.`);
    }

    const conflicts = findConflicts(upcoming);
    if (conflicts.length) lines.push(`⚠ Double-booked: ${conflicts.join('; ')}.`);

    if (i.tasksOverdue.length) {
      lines.push(`${i.tasksOverdue.length} overdue task${i.tasksOverdue.length > 1 ? 's' : ''}, oldest: "${i.tasksOverdue[0].title}".`);
    }
    if (i.tasksDueToday.length) {
      lines.push(`Due today: ${i.tasksDueToday.slice(0, 3).map((t) => t.title).join(', ')}${i.tasksDueToday.length > 3 ? `, +${i.tasksDueToday.length - 3} more` : ''}.`);
    }

    if (i.needsReply.length) {
      const who = i.needsReply.slice(0, 3).map((t) => t.fromName ?? 'someone').join(', ');
      lines.push(`${i.needsReply.length} email${i.needsReply.length > 1 ? 's' : ''} waiting on you (${who}).`);
    } else if (i.unreadCount) {
      lines.push(`${i.unreadCount} unread, nothing obviously needing a reply.`);
    }

    if (i.weather) {
      const u = i.tempUnit ?? 'F';
      lines.push(`Weather: ${describeCode(i.weather.code)}, `
        + `${formatTemp(i.weather.tempMin, u)}–${formatTemp(i.weather.tempMax, u)}${u}. `
        + `${dressAdvice(i.weather)}.`);
    }

    if (i.habitsPending.length) lines.push(`Still to log: ${i.habitsPending.join(', ')}.`);

    return { headline, body: lines.join(' '), generator: 'template' };
  },
};

export function getBriefingGenerator(): BriefingGenerator {
  // return process.env.BRIEFING_GENERATOR === 'claude' ? claudeGenerator : templateGenerator;
  return templateGenerator;
}
