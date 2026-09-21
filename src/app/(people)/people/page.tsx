import { ensureIndustries, listContacts } from '@/features/people/queries';
import { createPeopleHost } from '@/lib/people-host';
import { requireUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function PeoplePage() {
  const user = await requireUser();
  if (!user) {
    return (
      <div className="card">
        <h2>Sign in</h2>
        <a className="btn" href="/login">Sign in</a>
      </div>
    );
  }

  const host = await createPeopleHost();
  await ensureIndustries(host);
  const contacts = await listContacts(host);

  return (
    <>
      <header className="pagehead">
        <div>
          <h1>People</h1>
          <div className="date">{contacts.length} {contacts.length === 1 ? 'person' : 'people'}</div>
        </div>
      </header>
      {contacts.length === 0 ? (
        <div className="card"><p className="empty">No one yet.</p></div>
      ) : (
        <div className="card">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {contacts.map((c) => (
              <li key={c.id}>
                {c.name} · {c.met_on}
                {c.company && ` · ${c.company}`}
                {c.job_title && ` · ${c.job_title}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
