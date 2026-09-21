import { NextResponse } from 'next/server';
import { autocomplete, placesConfigured, type Prediction } from '@/features/people/places/google';
import { listPlaces, searchPlaces } from '@/features/people/queries';
import { createPeopleHost } from '@/lib/people-host';
import { requireUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Own places first (instant, no API call), then Google predictions with any
 * already-saved place filtered out. If Google fails or the key is missing the
 * dropdown degrades to own places + free text; the failure is logged, not shown.
 */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const input = String(body.input ?? '').trim();
  const sessionToken = String(body.sessionToken ?? '');
  if (input.length < 2) return NextResponse.json({ own: [], google: [] });

  const host = await createPeopleHost();
  const own = await searchPlaces(host, input);

  let google: Prediction[] = [];
  if (placesConfigured() && sessionToken) {
    try {
      const [preds, saved] = await Promise.all([autocomplete(input, sessionToken), listPlaces(host)]);
      const savedIds = new Set(saved.map((p) => p.google_place_id).filter(Boolean));
      google = preds.filter((p) => !savedIds.has(p.placeId));
    } catch (e) {
      console.error('[people/places] autocomplete failed:', e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({
    own: own.map((p) => ({ id: p.id, name: p.name, neighborhood: p.neighborhood })),
    google,
  });
}
