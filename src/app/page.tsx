import { AccountFilter } from '@/components/AccountFilter';
import { AskPanel } from '@/components/AskPanel';
import { LocationPrompt } from '@/components/LocationPrompt';
import { ResolvePlace } from '@/components/ResolvePlace';
import { SyncButton } from '@/components/SyncButton';
import { TaskItem, type TaskRow } from '@/components/TaskItem';
import { WeatherPanel } from '@/components/WeatherPanel';
import { ToolBadge, accountTint, fmtTime } from '@/components/ui';
import {
  DAY_END_LABEL, formatClock, formatMins, freeTimeToday, whatFits,
} from '@/lib/briefing/freetime';
import { calendarBrief, inboxBrief, tasksBrief } from '@/lib/briefing/tabs';
import { ENABLE_GMAIL } from '@/lib/env';
import { fetchWeather } from '@/lib/providers/weather';
import {
  getAccounts, getCompletedToday, getHabitsToday, getProfile, getTasks,
  getTodayEvents, getTriage,
} from '@/lib/queries';
import { requireUser } from '@/lib/supabase/server';
import { minutesIn } from '@/lib/tz';

export const dynamic = 'force-dynamic';

function greeting(now: Date, tz: string): string {
  const hour = Number(now.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: tz }));
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default async function Home() {
  const user = await requireUser();
  if (!user) {
    return (
      <div className="card" style={{ maxWidth: 420 }}>
        <h2>Sign in</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Sign in to connect your accounts.
        </p>
        <a className="btn" href="/login">Sign in</a>
      </div>
    );
  }

  const profile = await getProfile();
  const tz = profile?.timezone ?? 'America/New_York';

  const [accounts, events, triage, tasks, habits, doneToday] = await Promise.all([
    getAccounts(), getTodayEvents(tz), getTriage(), getTasks(tz), getHabitsToday(),
    getCompletedToday(tz),
  ]);

  // The one live call on this page — keyless, fast, and there's no cached
  // representation the sync job could provide any better.
  let weather = null;
  if (profile?.lat != null && profile?.lon != null) {
    try {
      weather = await fetchWeather(profile.lat, profile.lon, tz);
    } catch {
      weather = null;
    }
  }

  const now = new Date();
  const name = profile?.display_name?.split(' ')[0]
    ?? (profile?.email ?? user.email ?? '').split('@')[0];
  // Name only. Raw coordinates in the header are noise at best, and a fixed
  // home address printed on screen at worst.
  const place = profile?.location_name ?? null;

  const unit = (profile?.temp_unit ?? 'F') as 'C' | 'F';
  const free = freeTimeToday(events, tz, now);
  const openToday = tasks.overdue.length + tasks.dueToday.length;

  const broken = accounts.filter((a) => a.status === 'reauth_required');
  const schedule = events.filter((e) => +new Date(e.ends_at) > +now);
  const priorities = [...tasks.overdue, ...tasks.dueToday].slice(0, 5);
  const dueSoon = [...tasks.overdue, ...tasks.dueToday, ...tasks.tomorrow, ...tasks.later]
    .slice(0, 5);

  const calBrief = calendarBrief(events, tz);
  const taskBrief = tasksBrief({ ...tasks, doneToday: doneToday.length });
  const mailBrief = inboxBrief(triage);

  return (
    <>
      <header className="pagehead">
        <div>
          <h1>{greeting(now, tz)}, {name}</h1>
          <div className="date">
            {now.toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric', timeZone: tz,
            })}
            {place && <> · {place}</>}
          </div>
        </div>
        <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <SyncButton />
          <a className="btn" href="/briefing">Daily Briefing</a>
        </span>
      </header>

      {broken.length > 0 && (
        <div className="banner bad">
          <strong>Reconnect needed.</strong>{' '}
          {broken.map((a) => a.label ?? a.email).join(', ')} stopped syncing —
          Google revoked or expired the token. <a href="/settings">Reconnect</a>
        </div>
      )}

      {accounts.length === 0 && (
        <div className="banner">
          No accounts connected yet.{' '}
          <a href="/settings">Connect your first Google account</a> to start pulling
          calendar, mail and tasks.
        </div>
      )}

      {profile?.lat == null && accounts.length > 0 && <LocationPrompt />}

      {/* Coordinates but no place name — or a name stored before we started
          tidying ISO country strings — resolve it once, silently. */}
      {profile?.lat != null && profile?.lon != null
        && (!profile.location_name || /\(the\)/i.test(profile.location_name)) && (
        <ResolvePlace lat={profile.lat} lon={profile.lon} />
      )}

      {!profile?.display_name && (
        <div className="banner">
          You&rsquo;re showing as an email address.{' '}
          <a href="/settings">Add your name</a> to fix the greeting.
        </div>
      )}

      <AccountFilter accounts={accounts} />

      {/* Hero: how much of today is actually yours, and the weather beside it. */}
      <div className="hero">
        <section className="card freecard">
          <h2>Free today</h2>
          <div className="free-value">
            {free.dayOver ? '—' : formatMins(free.freeMinutes)}
          </div>
          <div className="free-sub">
            {/* minutesIn, not getHours() — the server's clock is not the
                user's timezone. */}
            {free.dayOver
              ? 'the day is done'
              : `unclaimed between ${formatClock(Math.max(minutesIn(now, tz), 8 * 60))} and ${DAY_END_LABEL}`}
            {free.remainingMeetings > 0 && ` · ${free.remainingMeetings} meeting${free.remainingMeetings > 1 ? 's' : ''} left`}
          </div>
          <p className="free-fits">{whatFits(free, openToday)}</p>
        </section>

        <WeatherPanel weather={weather} place={place} unit={unit} />
      </div>

      {/* Scheduling chat. Slot arithmetic is server-side and deterministic; the
          model (if a key is configured) only phrases the answer. */}
      <div style={{ marginBottom: 16 }}>
        <AskPanel freeToday={formatMins(free.freeMinutes)} />
      </div>

      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        <section className="card">
          <h2>Today&rsquo;s Schedule</h2>
          {calBrief && <p className="cardbrief">{calBrief.headline}.</p>}
          {schedule.length === 0 ? <p className="empty">Nothing left on the calendar today.</p> : (
            <div className="rowlist">
              {schedule.map((e) => {
                const live = +new Date(e.starts_at) <= +now && +new Date(e.ends_at) > +now;
                return (
                  <div className={live ? 'row live' : 'row'} key={e.id}
                       style={accountTint(e.linked_accounts?.color)}>
                    <span className="time">
                      {e.all_day ? 'All day' : fmtTime(e.starts_at, tz)}
                    </span>
                    <span className="main-col">
                      <span className="t">
                        {e.html_link
                          ? <a href={e.html_link} target="_blank" rel="noreferrer">{e.title ?? 'Untitled'}</a>
                          : (e.title ?? 'Untitled')}
                      </span>
                      <span className="s meta">
                        {e.linked_accounts && (
                          <span className="acct">
                            <span className="dot sm" style={{ background: e.linked_accounts.color }} aria-hidden />
                            {e.linked_accounts.label ?? e.linked_accounts.email}
                          </span>
                        )}
                        {e.location && <span className="list">{e.location}</span>}
                      </span>
                    </span>
                    {live && <span className="pill now">now</span>}
                  </div>
                );
              })}
            </div>
          )}
          <a className="linkall" href="/calendar">View full calendar</a>
        </section>

        <section className="card">
          <h2>Top Priorities</h2>
          {taskBrief && <p className="cardbrief">{taskBrief.headline}.</p>}
          {priorities.length === 0 ? <p className="empty">Nothing due today.</p> : (
            <div className="rowlist">
              {priorities.map((t) => <TaskItem key={t.id} task={t as TaskRow} tz={tz} />)}
            </div>
          )}
          <a className="linkall" href="/tasks">View all tasks</a>
        </section>
      </div>

      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        {ENABLE_GMAIL && (
          <section className="card">
            <h2>Unread Emails <span className="count">({triage.unread.length})</span></h2>
            {mailBrief && <p className="cardbrief">{mailBrief.headline}.</p>}
            {triage.unread.length === 0 ? <p className="empty">Inbox is clear.</p> : (
              <div className="rowlist">
                {triage.unread.slice(0, 5).map((t) => (
                  <div className="row" key={t.id} style={accountTint(t.linked_accounts?.color)}>
                    <span className="main-col">
                      <span className="t">
                        {t.web_url
                          ? <a href={t.web_url} target="_blank" rel="noreferrer">{t.from_name ?? t.from_email}</a>
                          : (t.from_name ?? t.from_email)}
                      </span>
                      <span className="s meta">
                        {t.linked_accounts && (
                          <span className="acct">
                            <span className="dot sm" style={{ background: t.linked_accounts.color }} aria-hidden />
                            {t.linked_accounts.label ?? t.linked_accounts.email}
                          </span>
                        )}
                        <span className="list">{t.subject ?? '(no subject)'}</span>
                      </span>
                    </span>
                    <span className="when">{fmtTime(t.last_message_at, tz)}</span>
                  </div>
                ))}
              </div>
            )}
            <a className="linkall" href="/inbox">View all ({triage.all.length})</a>
          </section>
        )}

        <section className="card">
          <h2>Tasks Due</h2>
          <p className="cardbrief">
            {tasks.tomorrow.length > 0
              ? `${tasks.tomorrow.length} land${tasks.tomorrow.length === 1 ? 's' : ''} tomorrow.`
              : tasks.unscheduled.length > 0
                ? `${tasks.unscheduled.length} still have no date.`
                : 'Everything dated is under control.'}
          </p>
          {dueSoon.length === 0 ? <p className="empty">Nothing scheduled.</p> : (
            <div className="rowlist">
              {dueSoon.map((t) => <TaskItem key={t.id} task={t as TaskRow} tz={tz} />)}
            </div>
          )}
          <a className="linkall" href="/tasks">View all tasks</a>
        </section>
      </div>

      <section className="card">
        <h2>Connected Accounts</h2>
        <p className="cardbrief">
          {habits.length > 0
            ? `${habits.filter((h) => h.doneToday).length} of ${habits.length} habits logged today.`
            : 'Syncing every 15 minutes once deployed.'}
        </p>
        <div className="tools">
          {accounts.map((a) => (
            <a key={a.id} className={a.status === 'reauth_required' ? 'tool broken' : 'tool'}
               href="/settings">
              <ToolBadge label={a.label ?? a.email} color={a.color} />
              <span>
                {a.label ?? a.email}
                <br />
                <span className="sub">
                  {a.status === 'reauth_required'
                    ? 'needs reconnecting'
                    : a.last_synced_at
                      ? `synced ${fmtTime(a.last_synced_at, tz)}`
                      : 'awaiting first sync'}
                </span>
              </span>
            </a>
          ))}
          <a className="tool add" href="/settings">+ Add account</a>
        </div>
      </section>
    </>
  );
}
