'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * The account identity palette.
 *
 * Eight fixed slots, not a free colour picker. These are checked to stay
 * distinguishable from each other under deuteranopia and protanopia and to hold
 * contrast against both themes' surfaces; an arbitrary hex can fail all of that
 * at once. The commonest real outcome of a free picker here is two accounts
 * that look identical to about 8% of men, and the second commonest is a pale
 * yellow that vanishes on the light theme.
 *
 * Names, not hex codes, because "Colour #eda100" read aloud by a screen reader
 * tells you nothing.
 */
const PALETTE: { hex: string; name: string }[] = [
  { hex: '#2a78d6', name: 'Blue' },
  { hex: '#eb6834', name: 'Orange' },
  { hex: '#1baf7a', name: 'Teal' },
  { hex: '#eda100', name: 'Amber' },
  { hex: '#e87ba4', name: 'Pink' },
  { hex: '#008300', name: 'Green' },
  { hex: '#4a3aa7', name: 'Indigo' },
  { hex: '#e34948', name: 'Red' },
];

interface Account {
  id: string;
  email: string;
  label: string | null;
  color: string;
  status: string;
  last_synced_at: string | null;
  last_sync_error: string | null;
}

export function AccountRow({ account, taken = [] }: {
  account: Account;
  /** Colours already in use by the user's other accounts. */
  taken?: string[];
}) {
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
        <span className="swatches" role="radiogroup" aria-label="Account colour">
          {PALETTE.map((c) => {
            const selected = c.hex === color;
            // Flagged, not disabled. Two accounts sharing a colour is a bad
            // idea, not a forbidden one — you might genuinely want Cornell and
            // NYU to read as one "school" group, and blocking it would be the
            // app overruling you on your own dashboard.
            const inUse = !selected && taken.includes(c.hex);
            return (
              <button
                key={c.hex} type="button" onClick={() => setColor(c.hex)}
                role="radio" aria-checked={selected}
                aria-label={inUse ? `${c.name} (already used by another account)` : c.name}
                title={inUse ? `${c.name} — already used by another account` : c.name}
                className={`swatch${selected ? ' on' : ''}${inUse ? ' used' : ''}`}
                style={{ background: c.hex }}
              >
                {/* A ring alone carries the selection; the tick keeps it legible
                    for anyone who can't separate the ring from the fill. */}
                {selected && <span className="swatch-tick" aria-hidden>✓</span>}
              </button>
            );
          })}
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
        {/* Was "Rename", which hid the colour picker behind a label that
            promised only one of the two things the panel does. */}
        <button className="btn secondary" onClick={() => setEditing(true)}>
          Name &amp; colour
        </button>
        <button className="btn secondary" onClick={disconnect} disabled={busy}
                title="Removes this account and all its synced data">
          Disconnect
        </button>
      </span>
    </div>
  );
}
