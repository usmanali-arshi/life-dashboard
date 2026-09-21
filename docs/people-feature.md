# People tab: build spec

A directory of people Usman has met in NYC: where, when, who, and notes, with search and
filters. Lives as a tab in Life Dashboard but is built so it can be extracted into its own
app later.

Read `docs/claude_context.md` first. Its §0 working agreement and §4 "things that bit us"
apply here in full. In particular: never read or echo `.env.local`; commits authored as
`Usman Ali <ua383@nyu.edu>`; build with plain `next build`, never `--no-lint`.

Mockups: screenshots in `docs/people-mockups/` (desktop wall, desktop card open, phone
home, phone quick-add). The design tokens below are the source of truth where a screenshot
is ambiguous.

---

## 1. Architecture rules

- **One-way dependency.** The dashboard may import from `src/features/people/`. People never
  imports from dashboard code (`lib/providers`, `lib/sync`, `lib/briefing`, other tabs).
- **Layout:**
  ```
  src/features/people/
    types.ts          Contact, Place, Industry, SearchFilters
    host.ts           PeopleHost interface (see below)
    queries.ts        reads, via the host's Supabase client, schema 'people'
    actions.ts        server actions: create/update/delete contact, create place/industry
    places/google.ts  Places API (New) client, server-only
    components/       Wall, Polaroid, Drawer, QuickAddSheet, FilterBar, SearchInput
  src/app/(people)/people/page.tsx           thin wrapper
  src/app/api/people/places/autocomplete/route.ts
  src/app/api/people/places/details/route.ts
  ```
- **The seam:**
  ```ts
  export interface PeopleHost {
    getUserId(): Promise<string>;              // throws if not signed in
    db(): SupabaseClient;                       // RLS-scoped, never the secret key
  }
  ```
  The dashboard implements it in one file. A standalone app would implement it with its own auth.
- **Contacts belong to the app user**, not to a linked Google account.

## 2. Migration `supabase/migrations/0007_people.sql`

The Supabase DB is shared between local dev and production, so running this hits prod
immediately. It is purely additive, which is why that's fine. Do not write anything
destructive into this migration.

```sql
create extension if not exists pg_trgm;
create schema if not exists people;

create table people.industries (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users(id) on delete cascade,
  name     text not null,
  unique (user_id, name)
);

create table people.places (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  google_place_id   text,
  name              text not null,
  formatted_address text,
  neighborhood      text,
  lat               double precision,
  lng               double precision,
  created_at        timestamptz not null default now(),
  unique (user_id, google_place_id)
);

create table people.contacts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null check (length(trim(name)) > 0),
  met_on        date not null,                 -- floating date, see §4 of context doc
  place_id      uuid references people.places(id) on delete set null,
  industry_id   uuid references people.industries(id) on delete set null,
  job_title     text,
  company       text,
  instagram     text,                          -- handle without @, render the URL
  linkedin_url  text,
  phone_e164    text,                          -- normalized with libphonenumber-js
  notes         text,
  search_tsv    tsvector generated always as (
                  to_tsvector('simple',
                    coalesce(name,'') || ' ' || coalesce(company,'') || ' ' ||
                    coalesce(job_title,'') || ' ' || coalesce(notes,''))) stored,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index contacts_user_met_idx on people.contacts (user_id, met_on desc);
create index contacts_name_trgm_idx on people.contacts using gin (name gin_trgm_ops);
create index contacts_tsv_idx on people.contacts using gin (search_tsv);
create index contacts_place_idx on people.contacts (place_id);
create index contacts_industry_idx on people.contacts (industry_id);

-- RLS on every table
alter table people.industries enable row level security;
alter table people.places     enable row level security;
alter table people.contacts   enable row level security;

create policy own_rows on people.industries for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on people.places for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on people.contacts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Non-public schema needs explicit grants
grant usage on schema people to authenticated;
grant select, insert, update, delete on all tables in schema people to authenticated;

-- updated_at trigger
create or replace function people.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger contacts_touch before update on people.contacts
  for each row execute function people.touch_updated_at();
```

Also add a `security invoker` search function, `people.search_contacts(q text, place uuid,
industry uuid, met_from date, met_to date)`, combining trigram similarity on `name`
(`name % q or name ilike '%'||q||'%'`) with `search_tsv @@ plainto_tsquery('simple', q)`,
ordered by `met_on desc`. Filters apply in SQL, never client-side, so counts and the visible
list can't disagree (same reasoning as the task account filter).

Industry starter seed, inserted per user on first visit if they have none: Tech, Finance,
VC, Media, Fashion, Food & Bev, Academia.

**Manual step (Usman, in the Supabase dashboard):** Project Settings → Data API → Exposed
schemas → add `people`. Without it every query fails with a schema error that looks like
broken code. Client code queries with `.schema('people')`.

## 3. Places proxy

Both routes require a signed-in user (401 otherwise) so the key can't be used by anyone
else. Key comes from `GOOGLE_PLACES_API_KEY`; never a `NEXT_PUBLIC_` var.

- **Autocomplete:** `POST https://places.googleapis.com/v1/places:autocomplete`, header
  `X-Goog-Api-Key`, body `{ input, sessionToken, locationBias: { circle: { center: NYC,
  radius: 50000 } } }`. Client generates a UUID session token per search, debounces 250 ms,
  min 2 chars.
- **Details:** `GET https://places.googleapis.com/v1/places/{id}?sessionToken=...` with
  `X-Goog-FieldMask: id,formattedAddress,location,addressComponents`. Take the display name
  from the autocomplete prediction's main text rather than requesting `displayName`. Pull
  `neighborhood` from address components (`neighborhood`, else `sublocality_level_1`).
- **Dropdown order:** the user's own places first (local `ilike` query, instant, no API
  call), then Google predictions with any `google_place_id` already saved filtered out, then
  "Use '<text>' as typed". Show "Powered by Google" under Google results.
- Upsert into `people.places` on `(user_id, google_place_id)`.
- If Google fails or the key is missing, the dropdown silently degrades to own places plus
  free text. Log it server-side.

## 4. UI

### Tokens (light)

| Token | Value | Use |
|---|---|---|
| paper | `#F5EFE4` + dot grid `radial-gradient(#E3D8C5 1px, transparent 1px)` 24 px | page |
| surface | `#FBF8F2` | nav, drawer, sheet |
| card | `#FFFFFF` | polaroids, inputs |
| ink | `#1F1B16` | text, selected chips |
| muted | `#6B6257` | secondary text |
| line | `#E4DACA` | borders |
| accent | `#C8452F` | primary button, active tab, focus |
| tape | `rgba(246,227,168,0.85)` | polaroid tape |
| avatar tints | `#F4C9B8 #CFE3D4 #D6D9F2 #F6E3A8 #F2CBDD #C9E4EE` | picked by hash of contact id |

Dark: page `#1A1714`, surface `#24201B`, ink `#F2EBDF`, muted `#A89E90`, line `#3A342D`,
accent `#E0674F`. Polaroids stay light in dark mode (they're physical objects on the board).

Fonts via `next/font/google`: **Fraunces** (headings), **DM Sans** (body), **Caveat**
(names on polaroids, month labels, small handwritten captions).

### Screens

- **Wall (home):** header "People" plus a Caveat subtitle with counts; "Met someone" primary
  button. Big rounded search input ("Who was that person from…"), Place and When dropdown
  filters, industry chips, view toggle (Wall active; Map and Web shown as "later",
  disabled). Contacts grouped by month (Caveat month label + count), 6-column grid on
  desktop, 2 on phone. Empty state: "Hmm, no one matches." plus a clear-filters button.
- **Polaroid:** white card, 12 px padding, tape strip on top, tinted square with serif
  initials, name in Caveat, "place · Sep 12" with pin icon, industry pill. Rotation
  deterministic from contact id, range ±2°, so cards don't shuffle on re-render.
- **Drawer:** opened by `?person=<id>` search param so it deep-links and the back button
  closes it. Contents: tilted polaroid, name, role, industry pill; where + when block;
  Call / Instagram / LinkedIn buttons, each hidden when empty; notes on a lined-paper
  block; detail rows; "also met at <place>" chips linking to those contacts; Edit and Delete.
- **Quick-add sheet:** bottom sheet on phone, modal on desktop. Fields in order: Name
  (autofocus), When (Today selected by default, Yesterday, date picker), Where (autocomplete
  above; defaults to last-used place), Notes. Optional fields collapsed as dashed chips:
  + Industry, + Role, + Company, + Instagram, + LinkedIn, + Phone; tapping one reveals its
  input. Buttons: "Save & add another" (keeps date and place sticky, clears the rest) and
  "Save". Warn, don't block, when the name closely matches an existing contact.
- Filters and search live in URL params so state survives refresh and back/forward.
- Touch targets ≥ 44 px. Real `<button>`, `<a>`, `<label>`. Accent on white text passes 4.5:1.

### Behaviour rules carried from the context doc

- Optimistic UI must explain failures; never silently revert.
- `met_on` is a date: parse, compare and display it as a floating date (`lib/dates.ts`
  semantics), never through `Date` in the user's zone.

## 5. PWA

`src/app/manifest.ts` (name "Life Dashboard", `display: "standalone"`, theme `#F5EFE4`,
192/512 icons plus a maskable 512), apple-touch-icon and `apple-mobile-web-app-capable`
meta, a minimal service worker that exists for installability only (no offline caching in
v1). Manifest `shortcuts`: "Met someone" → `/people?add=1`, which opens the quick-add
sheet. Floating "+" button visible on every tab on mobile.

## 6. Build order and stop points

Commit after each step once `next build` passes. Stop and hand back only at the ⏸ points.

1. Migration file + search function. ⏸ Usman runs it in the Supabase SQL Editor and adds
   `people` to Exposed schemas.
2. Module skeleton, `PeopleHost` implementation, route with a list of raw contacts, nav tab.
3. Server actions for create/update/delete; quick-add sheet with free-text place only.
4. Places proxy + autocomplete. ⏸ Usman adds `GOOGLE_PLACES_API_KEY` to `.env.local` and
   Vercel (Production + Preview).
5. Wall, polaroids, filters, search, drawer, empty state, dark theme.
6. PWA manifest, icons, service worker, shortcut.
7. ⏸ Usman pushes to `main`; verify on `life-dashboard-git-main-arshi8.vercel.app` (not a
   per-deploy hash URL).
8. Photos (§8). Migration `0008_people_photos.sql`. ⏸ Usman runs it in the SQL Editor. Then
   camera capture in the sheet, upload, photo on polaroid and drawer. Push as in step 7.

## 8. Photos

A selfie taken in the quick-add sheet becomes the polaroid image. Added after v1 shipped.

- **Capture:** a camera chip among the optional chips. `<input type="file" accept="image/*"
  capture="user">` opens the front camera directly on phones; on desktop it's a file picker.
  The sheet shows the thumbnail immediately; the photo can be retaken or removed before save.
  In the drawer, Edit offers the same control, so a photo can be added or replaced later.
- **Auto-compress, invisibly:** before upload the page draws the image onto a canvas at max
  800 px on the long edge and re-encodes as JPEG q0.82 (typically 60–150 KB). The user never
  sees this step. EXIF orientation is honoured via `createImageBitmap(file, { imageOrientation:
  'from-image' })`. Nothing larger than ~1 MB ever leaves the phone.
- **Storage:** Supabase Storage, **private** bucket `people-photos`, object path
  `<user_id>/<contact_id>.jpg`. RLS on `storage.objects` restricts every operation to objects
  under the caller's own `auth.uid()` folder. Chosen over Vercel Blob / R2 because the auth
  model is the one every People table already uses and the free tier (1 GB, 2 GB egress/mo)
  covers thousands of photos at this size.
- **Column:** `people.contacts.photo_path text` (the object path, not a URL). Purely additive.
- **Serving:** signed URLs, ~1 h, generated server-side in one `createSignedUrls` batch per
  page render for the visible contacts. Never a public bucket — these are other people's faces.
- **Order of operations:** contact row first, then upload (the path needs the contact id), then
  `update ... set photo_path`. If upload fails the contact still saves and the sheet says so
  with a Retry on the card, rather than losing the entry. Deleting a contact removes the object.
- **Polaroid:** photo fills the tinted square (`object-fit: cover`); initials remain the
  fallback and the loading state.

## 7. Out of scope for v1

- **Auto follow-up task on new contact.** Quick-add toggle "Follow up within a week",
  default on, creates a Google Task `Coffee with <name> (<place>)` due `met_on + 7d` with a
  deep link (`/people?person=<id>`) and 2 or 3 free windows from `scheduling/slots.ts` in the
  notes. People must not import `TaskProvider`: expose `onContactCreated(contact)` and let the
  dashboard register the handler. Google first, then the local `tasks` mirror row. Contact
  always saves; task failure shows "Retry" on the card. Destination account + list picked in
  Settings. Migration adds `followup_task_external_id text` and `followup_status text check
  (pending|created|failed|done|skipped)`. No new OAuth scope needed.
- Map view (places already store coordinates), Web view, CSV import, offline capture.
