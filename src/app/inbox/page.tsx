import { notFound } from 'next/navigation';
import { AccountFilter } from '@/components/AccountFilter';
import { TabBrief } from '@/components/TabBrief';
import { accountTint } from '@/components/ui';
import { inboxBrief } from '@/lib/briefing/tabs';
import { ENABLE_GMAIL } from '@/lib/env';
import { getAccounts, getTriage } from '@/lib/queries';

export const dynamic = 'force-dynamic';

function ThreadList({ threads }: { threads: any[] }) {
  if (!threads.length) return <p className="empty">Nothing here.</p>;
  return (
    <div>
      {threads.map((t) => (
        <div className="row" key={t.id} style={accountTint(t.linked_accounts?.color)}>
          <span className="dot" style={{ background: t.linked_accounts?.color }} aria-hidden />
          <span className="main-col">
            <span className="t">
              {t.web_url
                ? <a href={t.web_url} target="_blank" rel="noreferrer">{t.subject ?? '(no subject)'}</a>
                : (t.subject ?? '(no subject)')}
            </span>
            <span className="s">
              {t.from_name ?? t.from_email} · {t.linked_accounts?.label ?? t.linked_accounts?.email} ·{' '}
              {new Date(t.last_message_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
            {/* Gmail's own snippet. We never store or display message bodies. */}
            {t.snippet && <span className="s" style={{ color: 'var(--text-secondary)' }}>{t.snippet}</span>}
          </span>
          {t.is_unread && <span className="pill">unread</span>}
        </div>
      ))}
    </div>
  );
}

export default async function InboxPage() {
  if (!ENABLE_GMAIL) notFound();
  const [{ needsReply, unread, all }, accounts] = await Promise.all([
    getTriage(), getAccounts(),
  ]);
  const other = all.filter((t) => !t.needs_reply && !t.is_unread);

  return (
    <>
      <header className="pagehead">
        <div>
          <h1>Emails</h1>
          <div className="date">Metadata and snippets only — never message bodies</div>
        </div>
      </header>
    <AccountFilter accounts={accounts} />
    <TabBrief brief={inboxBrief({ needsReply, unread, all })} />
    <div className="grid">
      <section className="card">
        <h2>Waiting on you ({needsReply.length})</h2>
        <ThreadList threads={needsReply} />
      </section>
      <section className="card">
        <h2>Unread ({unread.filter((t) => !t.needs_reply).length})</h2>
        <ThreadList threads={unread.filter((t) => !t.needs_reply)} />
      </section>
      <section className="card">
        <h2>Recent</h2>
        <ThreadList threads={other.slice(0, 25)} />
      </section>
    </div>
    </>
  );
}
