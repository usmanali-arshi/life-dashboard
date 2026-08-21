'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

interface Acct {
  id: string; email: string; label: string | null; color: string; visible: boolean;
}

/**
 * Global account filter. One row above the content, applied on every tab.
 *
 * The toggle persists to the row rather than to component state, so the filter
 * is applied in SQL — a hidden account's events never reach the browser, and
 * counts, the briefing, and the calendar all agree with what's on screen.
 */
export function AccountFilter({ accounts }: { accounts: Acct[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  // Optimistic overlay so the chip responds instantly instead of waiting on a
  // round trip plus a server re-render.
  const [override, setOverride] = useState<Record<string, boolean>>({});

  if (accounts.length < 2) return null;

  const isVisible = (a: Acct) => override[a.id] ?? a.visible;
  const shownCount = accounts.filter(isVisible).length;

  async function toggle(a: Acct, next: boolean) {
    setBusyId(a.id);
    setOverride((o) => ({ ...o, [a.id]: next }));
    const res = await fetch(`/api/accounts/${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visible: next }),
    });
    setBusyId(null);
    if (!res.ok) {
      setOverride((o) => ({ ...o, [a.id]: !next }));  // roll back
      return;
    }
    startTransition(() => router.refresh());
  }

  async function setAll(next: boolean) {
    setOverride(Object.fromEntries(accounts.map((a) => [a.id, next])));
    await Promise.all(accounts.map((a) =>
      fetch(`/api/accounts/${a.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible: next }),
      })));
    startTransition(() => router.refresh());
  }

  return (
    <div className="filterbar" data-pending={pending ? '' : undefined}>
      <span className="lbl">Showing</span>
      {accounts.map((a) => {
        const on = isVisible(a);
        return (
          <button
            key={a.id}
            className={on ? 'chip on' : 'chip'}
            onClick={() => toggle(a, !on)}
            disabled={busyId === a.id}
            aria-pressed={on}
            title={on ? `Hide ${a.email}` : `Show ${a.email}`}
          >
            {/* Colour identifies the account; the label repeats it in text and
                the on/off state is carried by fill + strikethrough, never by
                colour alone. */}
            <span className="swatch" style={{ background: on ? a.color : 'transparent',
                                              borderColor: a.color }} aria-hidden />
            {a.label ?? a.email}
          </button>
        );
      })}
      {shownCount === 0 ? (
        <button className="linkbtn" onClick={() => setAll(true)}>Show all</button>
      ) : shownCount < accounts.length ? (
        <button className="linkbtn" onClick={() => setAll(true)}>Show all</button>
      ) : (
        <button className="linkbtn" onClick={() => setAll(false)}>Hide all</button>
      )}
    </div>
  );
}
