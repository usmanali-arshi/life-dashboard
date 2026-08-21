import { NextResponse } from 'next/server';
import { encrypt } from '@/lib/crypto';
import { decodeIdToken, exchangeCode, scopeList } from '@/lib/google/oauth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/supabase/server';

/**
 * Account identity colors, assigned in fixed order and never cycled or
 * reassigned — a color follows the account, so removing NYU must not repaint
 * Cornell. These are the validated categorical slots (light mode); the dark
 * steps live in globals.css. Account name is always rendered next to the dot,
 * so identity is never carried by color alone.
 */
const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const settings = new URL('/settings', url.origin);

  const error = url.searchParams.get('error');
  if (error) {
    settings.searchParams.set('error', error);
    return NextResponse.redirect(settings);
  }

  const user = await requireUser();
  if (!user) return NextResponse.redirect(new URL('/login', url.origin));

  const code = url.searchParams.get('code');
  const rawState = url.searchParams.get('state');
  if (!code || !rawState) {
    settings.searchParams.set('error', 'missing_code');
    return NextResponse.redirect(settings);
  }

  // CSRF check
  const cookieNonce = req.headers.get('cookie')?.match(/oauth_nonce=([^;]+)/)?.[1];
  let state: { nonce: string; label: string };
  try {
    state = JSON.parse(Buffer.from(rawState, 'base64url').toString('utf8'));
  } catch {
    settings.searchParams.set('error', 'bad_state');
    return NextResponse.redirect(settings);
  }
  if (!cookieNonce || cookieNonce !== state.nonce) {
    settings.searchParams.set('error', 'state_mismatch');
    return NextResponse.redirect(settings);
  }

  const tokens = await exchangeCode(code);

  // Google only issues a refresh_token on first consent. We force one with
  // prompt=consent, so absence here means something is genuinely wrong —
  // usually a stale grant. Tell the user to revoke and retry rather than
  // storing a useless row.
  if (!tokens.refresh_token) {
    settings.searchParams.set('error', 'no_refresh_token');
    return NextResponse.redirect(settings);
  }
  if (!tokens.id_token) {
    settings.searchParams.set('error', 'no_id_token');
    return NextResponse.redirect(settings);
  }

  const identity = decodeIdToken(tokens.id_token);
  const db = supabaseAdmin();

  // Ensure the profile row exists before the FK insert below.
  //
  // profiles is normally populated by the on_auth_user_created trigger, but any
  // user who signed up BEFORE the migration ran has no row — and linked_accounts
  // .user_id references profiles(id), so linking fails with a foreign key
  // violation that reads like a bug in the OAuth flow. Idempotent, one cheap
  // upsert per link, and it makes the ordering of signup vs migration irrelevant.
  const { error: profileError } = await db.from('profiles').upsert(
    { id: user.id, email: user.email ?? identity.email },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (profileError) {
    settings.searchParams.set('error', `profile: ${profileError.message}`);
    return NextResponse.redirect(settings);
  }

  const { count } = await db.from('linked_accounts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const { error: dbError } = await db.from('linked_accounts').upsert({
    user_id: user.id,
    provider: 'google',
    provider_user_id: identity.sub,
    email: identity.email,
    label: state.label || identity.email.split('@')[1]?.split('.')[0] || null,
    color: PALETTE[(count ?? 0) % PALETTE.length],
    refresh_token_enc: encrypt(tokens.refresh_token),
    scopes: scopeList(),
    status: 'active',
    last_sync_error: null,
  }, { onConflict: 'user_id,provider,provider_user_id' });

  if (dbError) {
    settings.searchParams.set('error', dbError.message);
    return NextResponse.redirect(settings);
  }

  settings.searchParams.set('linked', identity.email);
  const res = NextResponse.redirect(settings);
  res.cookies.delete('oauth_nonce');
  return res;
}
