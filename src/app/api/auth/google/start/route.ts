import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { authUrl } from '@/lib/google/oauth';
import { requireUser } from '@/lib/supabase/server';

/**
 * Begin linking a Google data account. Hit this once per account — personal,
 * Cornell, NYU, work. Each pass produces its own refresh token row.
 */
export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.redirect(new URL('/login', req.url));

  const label = new URL(req.url).searchParams.get('label') ?? '';

  // CSRF: random nonce in an httpOnly cookie, echoed through Google's `state`
  // and compared on the way back. Label rides along so we don't need a session.
  const nonce = randomBytes(16).toString('hex');
  const state = Buffer.from(JSON.stringify({ nonce, label })).toString('base64url');

  const res = NextResponse.redirect(authUrl(state));
  res.cookies.set('oauth_nonce', nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return res;
}
