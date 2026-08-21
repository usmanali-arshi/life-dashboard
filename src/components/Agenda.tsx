import { accountTint, fmtDay, fmtTime } from './ui';

interface EventRow {
  id: string;
  title: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  location: string | null;
  attendee_count: number;
  conference_url: string | null;
  html_link: string | null;
  linked_accounts: { label: string | null; email: string; color: string } | null;
}

export function Agenda({ events, tz, showDate = false }: {
  events: EventRow[]; tz: string; showDate?: boolean;
}) {
  if (!events.length) return <p className="empty">Nothing scheduled.</p>;
  const now = Date.now();

  return (
    <div className="rowlist">
      {events.map((e) => {
        const live = +new Date(e.starts_at) <= now && +new Date(e.ends_at) > now;
        const account = e.linked_accounts;
        const meta = [
          account?.label ?? account?.email,
          e.location,
          e.attendee_count > 1 ? `${e.attendee_count} people` : null,
        ].filter(Boolean).join(' · ');

        return (
          <div className={live ? 'row live' : 'row'} key={e.id}
               style={accountTint(account?.color)}>
            <span className="time">
              {e.all_day ? 'All day' : fmtTime(e.starts_at, tz)}
              {showDate && (
                <><br /><span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                  {fmtDay(e.starts_at, tz)}
                </span></>
              )}
            </span>
            {/* Color identifies the account; the label right below repeats it in
                text, so this never depends on color alone. */}
            <span className="dot" style={{ background: account?.color ?? 'var(--series-1)' }} aria-hidden />
            <span className="main-col">
              <span className="t">
                {e.html_link
                  ? <a href={e.html_link} target="_blank" rel="noreferrer">{e.title ?? 'Untitled'}</a>
                  : (e.title ?? 'Untitled')}
              </span>
              {meta && <span className="s">{meta}</span>}
              {e.conference_url && (
                <span className="s">
                  <a href={e.conference_url} target="_blank" rel="noreferrer"
                     style={{ color: 'var(--accent)' }}>Join call</a>
                </span>
              )}
            </span>
            {live && <span className="pill now">now</span>}
          </div>
        );
      })}
    </div>
  );
}
