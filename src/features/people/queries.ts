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
  return (data ?? []) as Contact[];
}

export async function getContact(host: PeopleHost, id: string): Promise<Contact | null> {
  const { data, error } = await people(host).from('contacts').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as Contact | null;
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
