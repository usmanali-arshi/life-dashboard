import { AccountFilter } from '@/components/AccountFilter';
import { TabBrief } from '@/components/TabBrief';
import { WeekCalendar } from '@/components/WeekCalendar';
import { calendarBrief } from '@/lib/briefing/tabs';
import { getAccounts, getEventsRange, getProfile } from '@/lib/queries';
import { addDays, startOfDayUTC, todayKey, weekStart } from '@/lib/tz';

export const dynamic = 'force-dynamic';

export default async function CalendarPage({
  searchParams,
}: { searchParams: Promise<{ week?: string; full?: string }> }) {
  const profile = await getProfile();
  const tz = profile?.timezone ?? 'America/New_York';

  const params = await searchParams;
  const start = /^\d{4}-\d{2}-\d{2}$/.test(params.week ?? '')
    ? weekStart(params.week!)
    : weekStart(todayKey(tz));
  const end = addDays(start, 7);
  const fullDay = params.full === '1';

  const [events, accounts] = await Promise.all([
    getEventsRange(startOfDayUTC(start, tz).toISOString(), startOfDayUTC(end, tz).toISOString()),
    getAccounts(),
  ]);

  const fmtRange = () => {
    const a = new Date(`${start}T12:00:00Z`);
    const b = new Date(`${addDays(start, 6)}T12:00:00Z`);
    const o = { timeZone: 'UTC' } as const;
    const sameMonth = a.getUTCMonth() === b.getUTCMonth();
    const left = a.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...o });
    const right = b.toLocaleDateString('en-US',
      sameMonth ? { day: 'numeric', ...o } : { month: 'short', day: 'numeric', ...o });
    return `${left} – ${right}, ${b.toLocaleDateString('en-US', { year: 'numeric', ...o })}`;
  };

  return (
    <>
      <header className="pagehead">
        <div>
          <h1>Calendar</h1>
          <div className="date">Every connected account, one grid</div>
        </div>
      </header>

      <AccountFilter accounts={accounts} />
      <TabBrief brief={calendarBrief(events, tz)} />

      <div className="cal-toolbar">
        <a className="btn secondary" href={`/calendar?week=${addDays(start, -7)}`}>←</a>
        <a className="btn secondary" href="/calendar">Today</a>
        <a className="btn secondary" href={`/calendar?week=${addDays(start, 7)}`}>→</a>
        <span className="range">{fmtRange()}</span>
        <a
          className="btn secondary"
          href={`/calendar?week=${start}${fullDay ? '' : '&full=1'}`}
          title={fullDay
            ? 'Fit the grid to your events'
            : 'Show all 24 hours, including the empty ones'}
        >
          {fullDay ? 'Fit to events' : 'Full 24h'}
        </a>
        <span style={{ flex: 1 }} />
        {/* Legend is mandatory for ≥2 series — block color alone must never be
            the only way to tell which account an event belongs to. Each block
            also carries the account name in its tooltip. */}
        <span className="legend">
          {accounts.filter((a) => a.visible).map((a) => (
            <span className="item" key={a.id}>
              <span className="swatch" style={{ background: a.color }} aria-hidden />
              {a.label ?? a.email}
            </span>
          ))}
        </span>
      </div>

      {events.length === 0 ? (
        <div className="card"><p className="empty">Nothing scheduled this week.</p></div>
      ) : (
        <WeekCalendar events={events} tz={tz} start={start} fullDay={fullDay} />
      )}
    </>
  );
}
