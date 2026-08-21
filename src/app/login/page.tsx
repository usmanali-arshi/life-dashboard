'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useEffect, useState } from 'react';

/**
 * App login only. This is NOT how Google data accounts get connected — that's
 * the separate flow at /api/auth/google/start. See architecture.md section 4.
 *
 * Password is the default rather than magic link, deliberately:
 *   - Corporate mail scanners (Defender, Proofpoint) pre-fetch links in
 *     incoming mail, which BURNS a one-time magic link before you ever click
 *     it. You then get `otp_expired` on a link that arrived 10 seconds ago.
 *   - Supabase's built-in SMTP is rate-limited to a couple of emails per hour.
 * Neither problem exists with a password. Magic link is kept as a fallback.
 */

function client() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}

type Mode = 'password' | 'signup' | 'magic';

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Supabase returns auth errors in the URL *fragment*, which never reaches the
  // server — so without this they vanish silently and the user just lands back
  // on a signed-out page wondering what happened.
  useEffect(() => {
    const fromQuery = new URLSearchParams(window.location.search).get('error');
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const fromHash = hash.get('error_description') ?? hash.get('error');
    const found = fromHash ?? fromQuery;
    if (found) {
      setError(decodeURIComponent(found.replace(/\+/g, ' ')));
      history.replaceState(null, '', '/login');
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setCreated(false);
    setBusy(true);
    const sb = client();

    try {
      if (mode === 'password') {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = '/';
        return;
      }

      if (mode === 'signup') {
        const { data, error } = await sb.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            // Rides along on the auth user; the DB trigger copies it into
            // profiles.display_name so the dashboard can greet by first name
            // instead of by email address.
            data: { display_name: fullName.trim() },
          },
        });
        if (error) throw error;
        // session present => "Confirm email" is off and we're already signed in.
        if (data.session) {
          window.location.href = '/';
          return;
        }
        // No session: either email confirmation is on, or the address already
        // existed (Supabase returns a decoy success to avoid leaking which
        // addresses are registered).
        setCreated(true);
        setMode('password');
        return;
      }

      const { error } = await sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = { width: '100%' } as const;

  return (
    <div className="card" style={{ maxWidth: 400, margin: '10vh auto' }}>
      <h2 style={{ fontSize: 19 }}>Life Dashboard</h2>

      {created && (
        <div className="banner good" style={{ marginBottom: 14 }}>
          <strong>Account created.</strong>
          <div style={{ marginTop: 4, fontSize: 13.5, color: 'var(--text-secondary)' }}>
            Sign in below with the password you just chose.
          </div>
        </div>
      )}

      {error && (
        <div className="banner bad" style={{ marginBottom: 14 }}>
          {/* Supabase's raw messages are accurate but useless. Translate the
              three that actually happen into the action that resolves them. */}
          {/already registered/i.test(error) ? (
            <>
              <strong>That email already has an account.</strong>
              <div style={{ marginTop: 4, fontSize: 13.5, color: 'var(--text-secondary)' }}>
                If you tried a magic link earlier, that created the account with no
                password. Delete the user in Supabase → Authentication → Users, then
                create it again here.
              </div>
            </>
          ) : /invalid login credentials/i.test(error) ? (
            <>
              <strong>Wrong email or password.</strong>
              <div style={{ marginTop: 4, fontSize: 13.5, color: 'var(--text-secondary)' }}>
                If this account was created by a magic link it has no password at all —
                delete the user in Supabase → Authentication → Users and sign up again.
              </div>
            </>
          ) : /expired|otp/i.test(error) ? (
            <>
              {error}
              <div style={{ marginTop: 4, fontSize: 13.5, color: 'var(--text-secondary)' }}>
                Magic links are single-use and corporate mail scanners often open them
                first. Use a password instead.
              </div>
            </>
          ) : error}
        </div>
      )}
      {notice && <div className="banner good" style={{ marginBottom: 14 }}>{notice}</div>}

      {sent ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
          Sign-in link sent to <strong>{email}</strong>. It expires in an hour and
          works only once.{' '}
          <button className="btn secondary" style={{ marginTop: 12 }}
                  onClick={() => { setSent(false); setMode('password'); }}>
            Use a password instead
          </button>
        </p>
      ) : (
        <form onSubmit={submit} style={{ display: 'grid', gap: 10 }}>
          {mode === 'signup' && (
            <input
              className="input" style={inputStyle} type="text" required
              autoComplete="name" value={fullName} placeholder="First and last name"
              onChange={(e) => setFullName(e.target.value)}
            />
          )}
          <input
            className="input" style={inputStyle} type="email" required autoComplete="email"
            value={email} placeholder="you@example.com"
            onChange={(e) => setEmail(e.target.value)}
          />
          {mode !== 'magic' && (
            <input
              className="input" style={inputStyle} type="password" required minLength={8}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password} placeholder="Password (8+ characters)"
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
          <button className="btn" type="submit" disabled={busy}
                  style={{ justifyContent: 'center' }}>
            {busy ? 'Working…'
              : mode === 'password' ? 'Sign in'
              : mode === 'signup' ? 'Create account'
              : 'Email me a sign-in link'}
          </button>
        </form>
      )}

      {!sent && (
        <div style={{ marginTop: 14, display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13 }}>
          {mode !== 'password' && (
            <button className="linkbtn" onClick={() => setMode('password')}>Sign in with password</button>
          )}
          {mode !== 'signup' && (
            <button className="linkbtn" onClick={() => setMode('signup')}>Create an account</button>
          )}
          {mode !== 'magic' && (
            <button className="linkbtn" onClick={() => setMode('magic')}>Email me a link</button>
          )}
        </div>
      )}
    </div>
  );
}
