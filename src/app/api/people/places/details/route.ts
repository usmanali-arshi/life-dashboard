import { NextResponse } from 'next/server';
import { createPlace } from '@/features/people/actions';
import { details } from '@/features/people/places/google';
import { createPeopleHost } from '@/lib/people-host';
import { requireUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Resolve a Google prediction into a saved people.places row. The display name
 * comes from the prediction's main text (passed as ?name=) rather than a
 * displayName field request, which keeps the details call in the cheaper SKU.
 * Ends the autocomplete session, so the same sessionToken must be passed.
 */
export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get('id') ?? '';
  const name = (url.searchParams.get('name') ?? '').trim();
  const sessionToken = url.searchParams.get('sessionToken') ?? '';
  if (!id || !name) return NextResponse.json({ error: 'id and name are required' }, { status: 400 });

  const host = await createPeopleHost();
  try {
    const d = await details(id, sessionToken);
    const place = await createPlace(host, {
      name, google_place_id: d.placeId, formatted_address: d.formattedAddress,
      neighborhood: d.neighborhood, lat: d.lat, lng: d.lng,
    });
    return NextResponse.json({ place });
  } catch (e) {
    console.error('[people/places] details failed:', e instanceof Error ? e.message : e);
    // Still save the place by name so the contact isn't lost over a Google hiccup.
    const place = await createPlace(host, { name, google_place_id: id });
    return NextResponse.json({ place, degraded: true });
  }
}
