import { parsePhoneNumberFromString } from 'libphonenumber-js';
import type { PeopleHost } from './host';
import type { Contact, Industry, Place } from './types';

export interface ContactInput {
  name: string;
  met_on: string;
  /** Free-text place name; resolved to a people.places row. Empty means no place. */
  place_name?: string | null;
  /** Wins over place_name when set (a place picked from the dropdown). */
  place_id?: string | null;
  industry_id?: string | null;
  /** Creates the industry if industry_id is empty and this is set. */
  industry_name?: string | null;
  job_title?: string | null;
  company?: string | null;
  instagram?: string | null;
  linkedin_url?: string | null;
  phone?: string | null;
  notes?: string | null;
}

export interface PlaceInput {
  name: string;
  google_place_id?: string | null;
  formatted_address?: string | null;
  neighborhood?: string | null;
  lat?: number | null;
  lng?: number | null;
}

const people = (host: PeopleHost) => host.db().schema('people');
const clean = (s: string | null | undefined) => {
  const t = s?.trim();
  return t ? t : null;
};

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function normalizeInstagram(s: string | null | undefined): string | null {
  const t = clean(s);
  if (!t) return null;
  return t.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/.*$/, '');
}

function normalizeLinkedin(s: string | null | undefined): string | null {
  const t = clean(s);
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (/linkedin\.com/i.test(t)) return `https://${t}`;
  return `https://www.linkedin.com/in/${t.replace(/^\/+/, '')}`;
}

function normalizePhone(s: string | null | undefined): string | null {
  const t = clean(s);
  if (!t) return null;
  const parsed = parsePhoneNumberFromString(t, 'US');
  if (!parsed?.isValid()) throw new Error('That phone number doesn’t look valid');
  return parsed.number;
}

export async function createPlace(host: PeopleHost, input: PlaceInput): Promise<Place> {
  const userId = await host.getUserId();
  const name = clean(input.name);
  if (!name) throw new Error('Place needs a name');
  const gid = clean(input.google_place_id);

  if (gid) {
    const { data, error } = await people(host).from('places')
      .upsert({
        user_id: userId, google_place_id: gid, name,
        formatted_address: clean(input.formatted_address),
        neighborhood: clean(input.neighborhood),
        lat: input.lat ?? null, lng: input.lng ?? null,
      }, { onConflict: 'user_id,google_place_id' })
      .select('*').single();
    if (error) throw error;
    return data as Place;
  }

  // Free-text places have no Google id, so the unique constraint can't dedupe them.
  const { data: existing } = await people(host).from('places')
    .select('*').is('google_place_id', null).ilike('name', name).limit(1).maybeSingle();
  if (existing) return existing as Place;

  const { data, error } = await people(host).from('places')
    .insert({ user_id: userId, name }).select('*').single();
  if (error) throw error;
  return data as Place;
}

export async function createIndustry(host: PeopleHost, name: string): Promise<Industry> {
  const userId = await host.getUserId();
  const n = clean(name);
  if (!n) throw new Error('Industry needs a name');
  const { data: existing } = await people(host).from('industries')
    .select('*').ilike('name', n).limit(1).maybeSingle();
  if (existing) return existing as Industry;
  const { data, error } = await people(host).from('industries')
    .insert({ user_id: userId, name: n }).select('*').single();
  if (error) throw error;
  return data as Industry;
}

async function resolveRefs(host: PeopleHost, input: ContactInput) {
  let place_id = clean(input.place_id);
  if (!place_id && clean(input.place_name)) {
    place_id = (await createPlace(host, { name: input.place_name! })).id;
  }
  let industry_id = clean(input.industry_id);
  if (!industry_id && clean(input.industry_name)) {
    industry_id = (await createIndustry(host, input.industry_name!)).id;
  }
  return { place_id, industry_id };
}

function contactColumns(input: ContactInput) {
  const name = clean(input.name);
  if (!name) throw new Error('Name is required');
  if (!YMD.test(input.met_on)) throw new Error('Date must be YYYY-MM-DD');
  return {
    name,
    met_on: input.met_on,
    job_title: clean(input.job_title),
    company: clean(input.company),
    instagram: normalizeInstagram(input.instagram),
    linkedin_url: normalizeLinkedin(input.linkedin_url),
    phone_e164: normalizePhone(input.phone),
    notes: clean(input.notes),
  };
}

export async function createContact(host: PeopleHost, input: ContactInput): Promise<Contact> {
  const userId = await host.getUserId();
  const cols = contactColumns(input);
  const refs = await resolveRefs(host, input);
  const { data, error } = await people(host).from('contacts')
    .insert({ user_id: userId, ...cols, ...refs }).select('*').single();
  if (error) throw error;
  return data as Contact;
}

export async function updateContact(host: PeopleHost, id: string, input: ContactInput): Promise<Contact> {
  await host.getUserId();
  const cols = contactColumns(input);
  const refs = await resolveRefs(host, input);
  const { data, error } = await people(host).from('contacts')
    .update({ ...cols, ...refs }).eq('id', id).select('*').single();
  if (error) throw error;
  return data as Contact;
}

export async function deleteContact(host: PeopleHost, id: string): Promise<void> {
  await host.getUserId();
  const { error } = await people(host).from('contacts').delete().eq('id', id);
  if (error) throw error;
}
