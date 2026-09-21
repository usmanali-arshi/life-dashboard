import type { PeopleHost } from './host';
import type { Contact, Industry, Place, SearchFilters } from './types';

const people = (host: PeopleHost) => host.db().schema('people');

export async function listContacts(host: PeopleHost, f: SearchFilters = {}): Promise<Contact[]> {
  const { data, error } = await people(host).rpc('search_contacts', {
    q: f.q?.trim() || null,
    place: f.placeId ?? null,
    industry: f.industryId ?? null,
    met_from: f.metFrom ?? null,
    met_to: f.metTo ?? null,
  });
  if (error) throw error;
  // search_contacts orders by met_on only; break ties so same-day cards don't shuffle.
  return ((data ?? []) as Contact[]).sort((a, b) =>
    b.met_on.localeCompare(a.met_on) || b.created_at.localeCompare(a.created_at));
}

export async function getContact(host: PeopleHost, id: string): Promise<Contact | null> {
  const { data, error } = await people(host).from('contacts').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as Contact | null;
}

export async function listContactsAtPlace(
  host: PeopleHost, placeId: string, excludeId: string, limit = 8,
): Promise<Pick<Contact, 'id' | 'name'>[]> {
  const { data, error } = await people(host).from('contacts').select('id,name')
    .eq('place_id', placeId).neq('id', excludeId).order('met_on', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as Pick<Contact, 'id' | 'name'>[];
}

export async function listIndustries(host: PeopleHost): Promise<Industry[]> {
  const { data, error } = await people(host).from('industries').select('*').order('name');
  if (error) throw error;
  return (data ?? []) as Industry[];
}

export async function listPlaces(host: PeopleHost): Promise<Place[]> {
  const { data, error } = await people(host).from('places').select('*').order('name');
  if (error) throw error;
  return (data ?? []) as Place[];
}

/** Short-lived signed URLs for every contact that has a photo, keyed by contact id. */
export async function photoUrls(host: PeopleHost, contacts: Contact[], ttlSeconds = 3600): Promise<Map<string, string>> {
  const withPhoto = contacts.filter((c) => c.photo_path);
  const out = new Map<string, string>();
  if (withPhoto.length === 0) return out;
  const { data, error } = await host.db().storage.from('people-photos')
    .createSignedUrls(withPhoto.map((c) => c.photo_path!), ttlSeconds);
  if (error || !data) return out;
  const byPath = new Map(data.filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
  for (const c of withPhoto) {
    const u = byPath.get(c.photo_path!);
    if (u) out.set(c.id, u);
  }
  return out;
}

/** Own places matching a prefix/substring, for the autocomplete dropdown. */
export async function searchPlaces(host: PeopleHost, q: string, limit = 5): Promise<Place[]> {
  const t = q.trim();
  if (!t) return [];
  const { data, error } = await people(host).from('places').select('*')
    .ilike('name', `%${t.replace(/[%_]/g, '')}%`).order('name').limit(limit);
  if (error) throw error;
  return (data ?? []) as Place[];
}

/** Seeds the starter industries for the signed-in user if they have none. */
export async function ensureIndustries(host: PeopleHost): Promise<void> {
  const { error } = await people(host).rpc('seed_default_industries');
  if (error) throw error;
}
