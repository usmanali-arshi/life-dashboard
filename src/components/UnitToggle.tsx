'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { TempUnit } from '@/lib/providers/weather';

/**
 * °C / °F switch. Persisted on the profile, so it follows you across devices.
 *
 * Failures are surfaced rather than swallowed: an optimistic toggle that
 * silently reverts is indistinguishable from a dead button, and the most likely
 * cause (a migration that hasn't been run) is invisible from the UI otherwise.
 */
export function UnitToggle({ unit }: { unit: TempUnit }) {
  const router = useRouter();
  const [value, setValue] = useState<TempUnit>(unit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function set(next: TempUnit) {
    if (next === value || busy) return;
    const previous = value;
    setValue(next);                       // optimistic
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temp_unit: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setValue(previous);
        setError(
          /temp_unit|column/i.test(data.error ?? '')
            ? 'Run migration 0005 in Supabase to enable this.'
            : data.error ?? 'Could not save',
        );
        return;
      }
      router.refresh();
    } catch {
      setValue(previous);
      setError('Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {error && (
        <span style={{ fontSize: 11.5, color: 'var(--critical)', maxWidth: 190, lineHeight: 1.35 }}>
          {error}
        </span>
      )}
      <span className="unittoggle" role="group" aria-label="Temperature unit">
        {(['C', 'F'] as TempUnit[]).map((u) => (
          <button
            key={u} type="button" disabled={busy}
            className={value === u ? 'on' : undefined}
            aria-pressed={value === u}
            onClick={() => set(u)}
          >
            °{u}
          </button>
        ))}
      </span>
    </span>
  );
}
