import { templateGenerator } from '@/lib/briefing';
import { describeCode, dressAdvice, formatTemp, fetchWeather } from '@/lib/providers/weather';
import {
  getHabitsToday, getProfile, getTasks, getTodayEvents, getTriage,
} from '@/lib/queries';
import { requireUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function BriefingPage() {
  const user = await requireUser();
  if (!user) return <div className="card"><h2>Sign in</h2><a className="btn" href="/login">Sign in</a></div>;

  const profile = await getProfile();
  const tz = profile?.timezone ?? 'America/New_York';
  const [events, triage, tasks, habits] = await Promise.all([
    getTodayEvents(tz), getTriage(), getTasks(tz), getHabitsToday(),
  ]);

  let weather = null;
  if (profile?.lat != null && profile?.lon != null) {
    try { weather = await fetchWeather(profile.lat, profile.lon, tz); } catch { weather = null; }
  }

  const unit = (profile?.temp_unit ?? 'F') as 'C' | 'F';
  const now = new Date();
  const briefing = await templateGenerator.generate({
    now, timezone: tz,
    events: events.map((e) => ({
      title: e.title, startsAt: new Date(e.starts_at), endsAt: new Date(e.ends_at),
      allDay: e.all_day, accountLabel: e.linked_accounts?.label ?? '',
    })),
    needsReply: triage.needsReply.map((t) => ({ subject: t.subject, fromName: t.from_name })),
    unreadCount: triage.unread.length,
    tasksDueToday: tasks.dueToday.map((t) => ({ title: t.title })),
    tasksOverdue: tasks.overdue.map((t) => ({ title: t.title })),
    weather,
    tempUnit: (profile?.temp_unit ?? 'F') as 'C' | 'F',
    habitsPending: habits.filter((h) => !h.doneToday).map((h) => h.name),
  });

  return (
    <>
      <header className="pagehead">
        <div>
          <h1>Daily Briefing</h1>
          <div className="date">
            {now.toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric', timeZone: tz,
            })}
          </div>
        </div>
        <a className="btn secondary" href="/">Back to overview</a>
      </header>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 20 }}>{briefing.headline}</h2>
        <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.75, color: 'var(--text-secondary)' }}>
          {briefing.body || 'Nothing pressing today. Enjoy it.'}
        </p>
      </section>

      {/* Four scalars, no shared axis, no trend — tiles, not a chart. */}
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <div className="tile">
          <div className="label">Meetings</div>
          <div className="value">{events.filter((e) => !e.all_day && +new Date(e.ends_at) > +now).length}</div>
          <div className="sub">remaining today</div>
        </div>
        <div className="tile">
          <div className="label">Awaiting reply</div>
          <div className="value">{triage.needsReply.length}</div>
          <div className="sub">{triage.unread.length} unread</div>
        </div>
        <div className={tasks.overdue.length ? 'tile alert' : 'tile'}>
          <div className="label">Overdue</div>
          <div className="value">{tasks.overdue.length}</div>
          <div className="sub">{tasks.dueToday.length} due today</div>
        </div>
        <div className="tile">
          <div className="label">Habits</div>
          <div className="value">
            {habits.filter((h) => h.doneToday).length}/{habits.length}
          </div>
          <div className="sub">logged today</div>
        </div>
      </div>

      <section className="card">
        <h2>Weather</h2>
        {!weather ? (
          <p className="empty">
            No location set. Add <code>lat</code> and <code>lon</code> to your{' '}
            <code>profiles</code> row to switch this on.
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            {describeCode(weather.code)}, {formatTemp(weather.tempMin, unit)}–{formatTemp(weather.tempMax, unit)}{unit}.{' '}
            {dressAdvice(weather)}.
          </p>
        )}
      </section>
    </>
  );
}
