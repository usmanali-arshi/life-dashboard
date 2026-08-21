import { NextResponse } from 'next/server';
import { runSync } from '@/lib/sync/run';
import { requireUser } from '@/lib/supabase/server';

// Node runtime: the sync path uses node:crypto to decrypt refresh tokens.
export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * "Sync now" from the UI.
 *
 * Distinct from /api/cron/sync: that one is machine-facing and authenticates
 * with a bearer secret, and syncs every stale account across all users. This one
 * is session-authenticated and scoped to the logged-in user only — so a signed-in
 * user can never trigger work on anyone else's accounts.
 *
 * force: true skips the 10-minute staleness check, since a human clicking a
 * button is an explicit "I want it now".
 */
export async function POST() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const report = await runSync({ userId: user.id, force: true });
    return NextResponse.json({ ok: true, ...report });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[sync/now]', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
