import { AccountRow } from '@/components/AccountRow';
import { ProfileCard } from '@/components/ProfileCard';
import { SyncButton } from '@/components/SyncButton';
import { ENABLE_GMAIL } from '@/lib/env';
import { getAccounts, getProfile } from '@/lib/queries';
import { requireUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  state_mismatch: 'Security check failed — the request did not originate here. Try again.',
  no_refresh_token: 'Google did not return a refresh token. Revoke this app at myaccount.google.com/permissions and reconnect.',
  no_id_token: 'Google did not return an identity token. Try again.',
  access_denied: 'You declined the permission request.',
  admin_policy_enforced: 'That Workspace blocks third-party apps. Their admin must allowlist this client ID.',
};

export default async function SettingsPage({
  searchParams,
}: { searchParams: Promise<{ linked?: string; error?: string }> }) {
  const user = await requireUser();
  if (!user) {
    return <div className="card"><h2>Sign in</h2><a className="btn" href="/login">Sign in</a></div>;
  }

  const params = await searchParams;
  const [accounts, profile] = await Promise.all([getAccounts(), getProfile()]);

  return (
    <>
      <header className="pagehead">
        <div>
          <h1>Accounts</h1>
          <div className="date">Connect one Google account at a time — personal, Cornell, NYU, work.</div>
        </div>
        <SyncButton />
      </header>

      <div className="grid">
        {params.linked && (
          <div className="banner good">
            Connected <strong>{params.linked}</strong>. Hit <em>Sync now</em> to pull it in.
          </div>
        )}
        {params.error && (
          <div className="banner bad">{ERRORS[params.error] ?? `Connection failed: ${params.error}`}</div>
        )}

        <ProfileCard
          name={profile?.display_name ?? ''}
          timezone={profile?.timezone ?? 'America/New_York'}
          hasLocation={profile?.lat != null && profile?.lon != null}
          place={profile?.location_name}
        />

        <section className="card">
          <h2>Connected accounts</h2>
          {accounts.length === 0 && <p className="empty">None yet.</p>}
          <div className="rowlist">
            {accounts.map((a) => <AccountRow key={a.id} account={a} />)}
          </div>

          <form action="/api/auth/google/start" method="get"
                style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
            <input className="input" name="label" placeholder="Label (e.g. Cornell)"
                   style={{ flex: '1 1 200px', minWidth: 0 }} />
            <button className="btn" type="submit">Add Google account</button>
          </form>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.6 }}>
            Run this once per account. Google will show an &ldquo;unverified app&rdquo; warning —
            that&rsquo;s expected while the OAuth client is unverified. Click <em>Advanced → Go to
            Life Dashboard</em>. You can rename a label any time.
          </p>
        </section>

        <section className="card">
          <h2>Data &amp; scopes</h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
            Calendar and Gmail are read-only. Tasks is read-write so you can complete items here.
            Email is stored as <strong>metadata and Gmail&rsquo;s own snippet only</strong> — never
            message bodies or attachments — and purged after 30 days. Refresh tokens are encrypted
            at rest with AES-256-GCM.
            {!ENABLE_GMAIL && <> Gmail is currently <strong>disabled</strong> on this deployment.</>}
          </p>
        </section>
      </div>
    </>
  );
}
