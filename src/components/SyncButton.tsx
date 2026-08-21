'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Report {
  ok: boolean;
  accountsAttempted?: number;
  accountsSucceeded?: number;
  events?: number;
  threads?: number;
  tasks?: number;
  errors?: { account: string; error: string }[];
  error?: string;
}

export function SyncButton({ label = 'Sync now' }: { label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Report | null>(null);

  async function sync() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/sync/now', { method: 'POST' });
      const data: Report = await res.json();
      setResult(data);
      // Server Components hold the data, so a plain state update won't refresh
      // the page — this re-runs the server render with the new rows.
      if (data.ok) router.refresh();
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <button className="btn secondary" onClick={sync} disabled={busy}>
        {busy ? 'Syncing…' : label}
      </button>
      {result && (
        <span style={{ fontSize: 13, color: result.ok ? 'var(--text-secondary)' : 'var(--critical)' }}>
          {result.ok
            ? result.accountsAttempted === 0
              ? 'No accounts connected yet.'
              : `${result.accountsSucceeded}/${result.accountsAttempted} accounts · `
                + `${result.events ?? 0} events · ${result.threads ?? 0} emails · ${result.tasks ?? 0} tasks`
            : result.error ?? 'Sync failed'}
          {result.errors?.length ? ` — ${result.errors[0].account}: ${result.errors[0].error}` : ''}
        </span>
      )}
    </span>
  );
}
