'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];

interface Account {
  id: string;
  email: string;
  label: string | null;
  color: string;
  status: string;
  last_synced_at: string | null;
  last_sync_error: string | null;
}

export function AccountRow({ account }: { account: Account }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(account.label ?? '');
  const [color, setColor] = useState(account.color);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/accounts/${account.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, color }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error ?? 'Failed to save'); return; }
    setEditing(false);
    router.refresh();
  }

  async function disconnect() {
    setBusy(true);
    const res = await fetch(`/api/accounts/${account.id}`, { method: 'DELETE' });
    setBusy(false);
    if (res.ok) router.refresh();
    else setError('Failed to disconnect');
  }

  if (editing) {
    return (
      <div className="row" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <input
          className="input" value={label} autoFocus placeholder={account.email}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
          style={{ flex: '1 1 180px', minWidth: 0 }}
        />
        <span style={{ display: 'flex', gap: 6 }}>
          {PALETTE.map((c) => (
            <button
              key={c} type="button" onClick={() => setColor(c)}
              aria-label={`Colour ${c}`} title={c}
              style={{
                width: 22, height: 22, borderRadius: 6, background: c, cursor: 'pointer',
                border: c === color ? '2px solid var(--text-primary)' : '2px solid transparent',
              }}
            />
          ))}
        </span>
        <button className="btn" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        <button className="btn secondary" onClick={() => setEditing(false)}>Cancel</button>
        {error && <span style={{ color: 'var(--critical)', fontSize: 13 }}>{error}</span>}
      </div>
    );
  }

  return (
    <div className="row" style={{ alignItems: 'center' }}>
      <span className="dot" style={{ background: account.color, marginTop: 0 }} aria-hidden />
      <span className="main-col">
        <span className="t">{account.label ?? account.email}</span>
        <span className="s">
          {account.email} ·{' '}
          {account.status === 'reauth_required'
            ? 'needs reconnecting'
            : account.last_synced_at
              ? `synced ${new Date(account.last_synced_at).toLocaleString('en-US')}`
              : 'waiting for first sync'}
        </span>
        {account.last_sync_error && (
          <span className="s" style={{ color: 'var(--critical)' }}>{account.last_sync_error}</span>
        )}
      </span>
      <span style={{ display: 'flex', gap: 8 }}>
        {account.status === 'reauth_required' && (
          <a className="btn secondary"
             href={`/api/auth/google/start?label=${encodeURIComponent(account.label ?? '')}`}>
            Reconnect
          </a>
        )}
        <button className="btn secondary" onClick={() => setEditing(true)}>Rename</button>
        <button className="btn secondary" onClick={disconnect} disabled={busy}
                title="Removes this account and all its synced data">
          Disconnect
        </button>
      </span>
    </div>
  );
}
