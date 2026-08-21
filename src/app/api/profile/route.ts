import { NextResponse } from 'next/server';
import { requireUser, supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Update the signed-in user's own profile: display name, timezone, coarse
 * location for weather.
 *
 * Goes through the RLS-scoped client, not the service-role one — the policy
 * (id = auth.uid()) is what guarantees a user can only write their own row,
 * rather than us remembering to filter.
 */
export async function PATCH(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};

  if (typeof body.display_name === 'string') {
    const name = body.display_name.trim().slice(0, 80);
    if (name) patch.display_name = name;
  }
  if (body.temp_unit === 'C' || body.temp_unit === 'F') {
    patch.temp_unit = body.temp_unit;
  }
  if (typeof body.location_name === 'string') {
    patch.location_name = body.location_name.trim().slice(0, 80) || null;
  }
  if (typeof body.timezone === 'string') {
    // Reject anything Intl doesn't recognise — a bad zone here would throw on
    // every page render, not just this request.
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: body.timezone });
      patch.timezone = body.timezone;
    } catch {
      return NextResponse.json({ error: 'invalid timezone' }, { status: 400 });
    }
  }
  if (body.lat != null && body.lon != null) {
    const lat = Number(body.lat), lon = Number(body.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)
      || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return NextResponse.json({ error: 'invalid coordinates' }, { status: 400 });
    }
    // Two decimals ≈ 1km. Enough for a weather forecast, and we have no reason
    // to store a more precise location than the task requires.
    patch.lat = Math.round(lat * 100) / 100;
    patch.lon = Math.round(lon * 100) / 100;
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  }

  const sb = await supabaseServer();
  const { error } = await sb.from('profiles')
    .upsert({ id: user.id, email: user.email, ...patch }, { onConflict: 'id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, ...patch });
}
