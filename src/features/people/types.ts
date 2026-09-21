/** Rows mirror the `people` schema (0007_people.sql). `met_on` is a floating date, 'YYYY-MM-DD'. */

export interface Industry {
  id: string;
  user_id: string;
  name: string;
}

export interface Place {
  id: string;
  user_id: string;
  google_place_id: string | null;
  name: string;
  formatted_address: string | null;
  neighborhood: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

export interface Contact {
  id: string;
  user_id: string;
  name: string;
  met_on: string;
  place_id: string | null;
  industry_id: string | null;
  job_title: string | null;
  company: string | null;
  instagram: string | null;
  linkedin_url: string | null;
  phone_e164: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Shape every host-side action returns; errors carry a message the UI can show. */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface SearchFilters {
  q?: string;
  placeId?: string;
  industryId?: string;
  metFrom?: string;
  metTo?: string;
}
