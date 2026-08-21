import { ENABLE_GMAIL, env, redirectUri } from '../env';

/**
 * Account-linking OAuth, deliberately hand-rolled rather than using Supabase's
 * Google provider.
 *
 * Supabase Auth manages ONE provider identity per user. Usman needs four
 * (personal, Cornell, NYU, work) attached to a single login, so login and
 * data-access are separate flows that happen to share an identity provider.
 * See architecture.md section 4.
 */

export const SCOPES = {
  base: ['openid', 'https://www.googleapis.com/auth/userinfo.email'],
  calendar: ['https://www.googleapis.com/auth/calendar.readonly'],
  tasks: ['https://www.googleapis.com/auth/tasks'],
  // RESTRICTED SCOPE — triggers CASA at >100 users. Read-only on purpose;
  // never request gmail.modify.
  gmail: ['https://www.googleapis.com/auth/gmail.readonly'],
};

export function scopeList(): string[] {
  return [...SCOPES.base, ...SCOPES.calendar, ...SCOPES.tasks, ...(ENABLE_GMAIL ? SCOPES.gmail : [])];
}

export function authUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: env.googleClientId(),
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: scopeList().join(' '),
    // access_type=offline + prompt=consent is what guarantees a refresh_token.
    // Google only returns one on FIRST consent otherwise, so re-linking an
    // account you've already authorized would silently yield no token.
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  id_token?: string;
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.googleClientId(),
      client_secret: env.googleClientSecret(),
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export class ReauthRequiredError extends Error {
  constructor(message = 'Google rejected the refresh token') {
    super(message);
    this.name = 'ReauthRequiredError';
  }
}

/**
 * Access tokens are never persisted — they live ~1h and are cheap to re-derive.
 * Only the refresh token is stored (encrypted).
 */
export async function accessTokenFrom(refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env.googleClientId(),
      client_secret: env.googleClientSecret(),
      grant_type: 'refresh_token',
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    // invalid_grant = revoked by the user, expired (Testing-mode 7-day cap), or
    // decrypted with the wrong key. Unrecoverable without human reconsent.
    if (body?.error === 'invalid_grant') throw new ReauthRequiredError(body.error_description);
    throw new Error(`Refresh failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return body.access_token as string;
}

/** Decode the id_token payload. Signature check is unnecessary here: the token
 *  came directly from Google's token endpoint over TLS, not from the client. */
export function decodeIdToken(idToken: string): { sub: string; email: string; name?: string } {
  const payload = idToken.split('.')[1];
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}
