import { Suspense } from 'react';
import { Drawer } from '@/features/people/components/Drawer';
import { FilterBar } from '@/features/people/components/FilterBar';
import { QuickAddSheet } from '@/features/people/components/QuickAddSheet';
import { Wall } from '@/features/people/components/Wall';
import { peopleFontClass } from '@/features/people/fonts';
import {
  ensureIndustries, getContact, listContacts, listContactsAtPlace, listIndustries, listPlaces, photoUrls,
} from '@/features/people/queries';
import type { SearchFilters } from '@/features/people/types';
import { createPeopleHost } from '@/lib/people-host';
import { requireUser } from '@/lib/supabase/server';
import {
  createContactAction, deleteContactAction, removeContactPhotoAction, setContactPhotoAction, updateContactAction,
} from './actions';
import '@/features/people/components/people.css';

export const dynamic = 'force-dynamic';

type Params = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export default async function PeoplePage({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requireUser();
  if (!user) {
    return (
      <div className="card">
        <h2>Sign in</h2>
        <a className="btn" href="/login">Sign in</a>
      </div>
    );
  }

  const sp = await searchParams;
  const filters: SearchFilters = {
    q: str(sp.q) || undefined,
    placeId: str(sp.place) || undefined,
    industryId: str(sp.industry) || undefined,
    metFrom: YMD.test(str(sp.from)) ? str(sp.from) : undefined,
    metTo: YMD.test(str(sp.to)) ? str(sp.to) : undefined,
  };
  const filtered = Boolean(filters.q || filters.placeId || filters.industryId || filters.metFrom || filters.metTo);
  const personId = str(sp.person);

  const host = await createPeopleHost();
  await ensureIndustries(host);
  const [contacts, industries, places, all] = await Promise.all([
    listContacts(host, filters), listIndustries(host), listPlaces(host),
    filtered ? listContacts(host) : null,
  ]);
  const total = all ? all.length : contacts.length;
  const placeName = new Map(places.map((p) => [p.id, p.name]));
  const industryName = new Map(industries.map((i) => [i.id, i.name]));
  const existingNames = (all ?? contacts).map((c) => c.name);

  const lastPlaceId = (all ?? contacts).find((c) => c.place_id)?.place_id;
  const lastPlace = lastPlaceId && placeName.has(lastPlaceId)
    ? { placeId: lastPlaceId, name: placeName.get(lastPlaceId)! } : null;

  const person = personId ? await getContact(host, personId) : null;
  const photos = await photoUrls(host, person && !contacts.some((c) => c.id === person.id) ? [...contacts, person] : contacts);
  const personPlace = person?.place_id ? places.find((p) => p.id === person.place_id) ?? null : null;
  const alsoMet = person && personPlace ? await listContactsAtPlace(host, personPlace.id, person.id) : [];

  const query = new URLSearchParams(
    Object.entries({ q: filters.q, place: filters.placeId, industry: filters.industryId,
      when: str(sp.when), from: filters.metFrom, to: filters.metTo })
      .filter((e): e is [string, string] => Boolean(e[1])),
  ).toString();

  const placesUsed = new Set(contacts.map((c) => c.place_id).filter(Boolean)).size;
  const subtitle = filtered
    ? `${contacts.length} of ${total} ${total === 1 ? 'person' : 'people'}`
    : `${total} ${total === 1 ? 'person' : 'people'} · ${placesUsed} ${placesUsed === 1 ? 'place' : 'places'}`;

  return (
    <div className={`people ${peopleFontClass}`}>
      <header className="pp-head">
        <div>
          <h1>People</h1>
          <div className="pp-sub">{subtitle}</div>
        </div>
        <Suspense>
          <QuickAddSheet
            industries={industries} existingNames={existingNames}
            defaultPlace={lastPlace} onCreate={createContactAction}
            setPhoto={setContactPhotoAction} removePhoto={removeContactPhotoAction}
          />
        </Suspense>
      </header>

      <Suspense>
        <FilterBar places={places} industries={industries} />
      </Suspense>

      <Wall contacts={contacts} placeName={placeName} industryName={industryName} photoUrl={photos}
            query={query} filtered={filtered} />

      {person && (
        <Suspense>
          <Drawer
            key={person.id}
            contact={person} place={personPlace}
            industry={person.industry_id ? industries.find((i) => i.id === person.industry_id) ?? null : null}
            alsoMet={alsoMet} photoUrl={photos.get(person.id) ?? null}
            industries={industries} existingNames={existingNames}
            onUpdate={updateContactAction} onDelete={deleteContactAction}
            setPhoto={setContactPhotoAction} removePhoto={removeContactPhotoAction}
          />
        </Suspense>
      )}
    </div>
  );
}
