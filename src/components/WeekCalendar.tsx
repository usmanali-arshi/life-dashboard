import { addDays, dayKeyIn, minutesIn, partsIn } from '@/lib/tz';

interface Ev {
  id: string;
  title: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  status: string | null;
  html_link: string | null;
  location: string | null;
  linked_accounts: { label: string | null; email: string; color: string } | null;
}

const HOUR_H = 46;          // px per hour
const MIN_BLOCK_MIN = 24;   // floor on rendered duration so 15-min events stay readable

function label(e: Ev) { return e.title ?? 'Untitled'; }

function hhmm(mins: number) {
  const h = Math.floor(mins / 60), m = mins % 60;
  const ampm = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`;
}

/**
 * Assign overlapping events to side-by-side columns.
 *
 * Sweep in start order; an event reuses the first column whose last event has
 * already ended. Events that never overlap anything end up full width, which is
 * the common case and the one that should look clean.
 */
function layout(events: { ev: Ev; start: number; end: number }[]) {
  const sorted = [...events].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: { ev: Ev; start: number; end: number; col: number; cols: number }[] = [];
  let cluster: typeof out = [];
  let clusterEnd = -1;
  const colEnds: number[] = [];

  const flush = () => {
    const cols = colEnds.length || 1;
    cluster.forEach((c) => { c.cols = cols; });
    out.push(...cluster);
    cluster = [];
    colEnds.length = 0;
    clusterEnd = -1;
  };

  for (const e of sorted) {
    // A gap with nothing open closes the cluster — widths only need to be
    // shared among events that actually collide.
    if (cluster.length && e.start >= clusterEnd) flush();
    let col = colEnds.findIndex((end) => end <= e.start);
    if (col === -1) { colEnds.push(e.end); col = colEnds.length - 1; }
    else colEnds[col] = e.end;
    cluster.push({ ...e, col, cols: 1 });
    clusterEnd = Math.max(clusterEnd, e.end);
  }
  flush();
  return out;
}

export function WeekCalendar({ events, tz, start, fullDay = false }: {
  events: Ev[]; tz: string; start: string; fullDay?: boolean;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const today = dayKeyIn(new Date(), tz);
  const nowMin = minutesIn(new Date(), tz);

  const timed = events.filter((e) => !e.all_day && e.status !== 'cancelled');
  const allDay = events.filter((e) => e.all_day && e.status !== 'cancelled');

  // Fit the grid to the day's actual span rather than always showing 00:00–24:00.
  // A full 24-hour grid spends two thirds of its height on empty night hours and
  // squeezes every event to a third of its readable size. `fullDay` opts out.
  let lo = 8 * 60, hi = 19 * 60;
  for (const e of timed) {
    const s = minutesIn(e.starts_at, tz);
    const en = minutesIn(e.ends_at, tz);
    lo = Math.min(lo, s);
    hi = Math.max(hi, en > s ? en : s + 60);
  }
  if (days.includes(today)) { lo = Math.min(lo, nowMin); hi = Math.max(hi, nowMin); }

  const startHour = fullDay ? 0 : Math.max(0, Math.floor(lo / 60) - 1);
  const endHour = fullDay ? 24 : Math.min(24, Math.ceil(hi / 60) + 1);
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const spanMin = (endHour - startHour) * 60;
  const top = (mins: number) => ((mins - startHour * 60) / spanMin) * 100;

  const byDay = new Map<string, ReturnType<typeof layout>>();
  for (const day of days) {
    const inDay = timed
      .filter((e) => dayKeyIn(e.starts_at, tz) === day)
      .map((e) => {
        const s = minutesIn(e.starts_at, tz);
        // Events crossing midnight get clipped to this day's end — the grid is
        // one day per column and a block can't render past it.
        const rawEnd = dayKeyIn(e.ends_at, tz) === day ? minutesIn(e.ends_at, tz) : 24 * 60;
        return { ev: e, start: s, end: Math.max(rawEnd, s + MIN_BLOCK_MIN) };
      });
    byDay.set(day, layout(inDay));
  }

  return (
    <div className="cal-wrap">
      <div className="cal" style={{ ['--hour-h' as string]: `${HOUR_H}px` }}>
        <div className="cal-head">
          <div className="cell" />
          {days.map((d) => {
            const p = partsIn(`${d}T12:00:00Z`, 'UTC');
            const dow = new Date(`${d}T12:00:00Z`)
              .toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
            return (
              <div key={d} className={`cell${d === today ? ' is-today' : ''}`}>
                <div className="dow">{dow}</div>
                <div className="dom">{p.d}</div>
              </div>
            );
          })}
        </div>

        {allDay.length > 0 && (
          <div className="cal-allday">
            <div className="gutter">all-day</div>
            {days.map((d) => (
              <div className="cell" key={d}>
                {allDay.filter((e) => dayKeyIn(e.starts_at, tz) === d).map((e) => (
                  <a key={e.id} className="cal-chip" href={e.html_link ?? '#'}
                     target="_blank" rel="noreferrer" title={label(e)}
                     style={{ background: e.linked_accounts?.color ?? 'var(--series-1)' }}>
                    {label(e)}
                  </a>
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="cal-body">
          <div className="cal-gutter">
            {hours.map((h) => (
              <div className="hr" key={h}>{h > startHour && <span>{hhmm(h * 60)}</span>}</div>
            ))}
          </div>

          {days.map((d) => (
            <div className="cal-col" key={d}>
              {hours.map((h) => <div className="hr" key={h} />)}

              {d === today && nowMin >= startHour * 60 && nowMin <= endHour * 60 && (
                <div className="cal-now" style={{ top: `${top(nowMin)}%` }} />
              )}

              {(byDay.get(d) ?? []).map(({ ev, start: s, end, col, cols }) => {
                const color = ev.linked_accounts?.color ?? 'var(--series-1)';
                const width = 100 / cols;
                return (
                  <a
                    key={ev.id}
                    className={`cal-ev${ev.status === 'tentative' ? ' tentative' : ''}`}
                    href={ev.html_link ?? '#'} target="_blank" rel="noreferrer"
                    title={`${label(ev)} · ${hhmm(s)}–${hhmm(end)}`
                      + `${ev.location ? ` · ${ev.location}` : ''}`
                      + ` · ${ev.linked_accounts?.label ?? ev.linked_accounts?.email ?? ''}`}
                    style={{
                      top: `${top(s)}%`,
                      height: `${((end - s) / spanMin) * 100}%`,
                      left: `${col * width}%`,
                      width: `${width}%`,
                      background: color,
                    }}
                  >
                    <span className="ttl">{label(ev)}</span>
                    {end - s >= 45 && <span className="tm">{hhmm(s)}</span>}
                  </a>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
