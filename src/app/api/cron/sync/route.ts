import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { runSync } from '@/lib/sync/run';

// Node runtime: the sync path uses node:crypto for token decryption.
export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function authorized(req: Request): boolean {
  const header = req.headers.get('authorization') ?? '';
  const provided = header.replace(/^Bearer\s+/i, '');
  const expected = env.cronSecret();
  if (provided.length !== expected.length) return false;
  // Constant-time: a length-independent === would leak the secret one byte at
  // a time to anyone willing to time the endpoint.
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

/**
 * Called by .github/workflows/sync.yml every 15 minutes.
 * Vercel's own cron would be simpler but Hobby is capped at once per day.
 */
export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const report = await runSync();
    return NextResponse.json({ ok: true, ...report });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[cron/sync] fatal', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const GET = POST;
