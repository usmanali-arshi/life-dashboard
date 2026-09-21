import { Suspense } from 'react';
import { QuickAddSheet } from '@/features/people/components/QuickAddSheet';
import { ensureIndustries, listContacts, listIndustries, listPlaces } from '@/features/people/queries';
import { createPeopleHost } from '@/lib/people-host';
import { requireUser } from '@/lib/supabase/server';
import { createContactAction } from './actions';
import '@/features/people/components/people.css';

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
  const [contacts, industries, places] = await Promise.all([
    listContacts(host), listIndustries(host), listPlaces(host),
  ]);
  const placeName = new Map(places.map((p) => [p.id, p.name]));
  const lastPlaceId = contacts.find((c) => c.place_id)?.place_id;
  const lastPlace = lastPlaceId && placeName.has(lastPlaceId)
    ? { placeId: lastPlaceId, name: placeName.get(lastPlaceId)! } : null;

  return (
    <div className="people">
      <header className="pagehead">
        <div>
          <h1>People</h1>
          <div className="pp-sub">{contacts.length} {contacts.length === 1 ? 'person' : 'people'}</div>
        </div>
        <Suspense>
          <QuickAddSheet
            industries={industries}
            existingNames={contacts.map((c) => c.name)}
            defaultPlace={lastPlace}
            onCreate={createContactAction}
          />
        </Suspense>
      </header>
      {contacts.length === 0 ? (
        <p className="pp-sub">No one yet.</p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          {contacts.map((c) => (
            <li key={c.id}>
              <strong>{c.name}</strong> · {c.met_on}
              {c.place_id && placeName.get(c.place_id) && ` · ${placeName.get(c.place_id)}`}
              {c.company && ` · ${c.company}`}
              {c.job_title && ` · ${c.job_title}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
