import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * Magic-link / OAuth landing point.
 *
 * The browser client uses the PKCE flow, so Supabase redirects here with a
 * `code` that still has to be exchanged for a session and written to cookies.
 * Without this route the link "works" — you land on the homepage — but no
 * session cookie is ever set, so the app still thinks you're signed out.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error_description') ?? url.searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, url.origin));
  }
  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', url.origin));
  }

  const sb = await supabaseServer();
  const { error: exchangeError } = await sb.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(exchangeError.message)}`, url.origin),
    );
  }

  return NextResponse.redirect(new URL('/', url.origin));
}
