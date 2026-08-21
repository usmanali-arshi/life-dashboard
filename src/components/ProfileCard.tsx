'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { reverseGeocode } from '@/lib/geo';

export function ProfileCard({ name, timezone, hasLocation, place }: {
  name: string; timezone: string; hasLocation: boolean; place?: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(patch: Record<string, unknown>) {
    setBusy(true); setError(null); setSaved(false);
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error ?? 'Failed to save'); return; }
    setSaved(true);
    router.refresh();
  }

  function useMyLocation() {
    if (!navigator.geolocation) { setError('This browser has no location API.'); return; }
    setBusy(true); setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const place = await reverseGeocode(latitude, longitude);
        await save({
          lat: latitude,
          lon: longitude,
          location_name: place ?? undefined,
          // Grab the browser's zone at the same time — it's almost always right
          // and saves a second prompt.
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
      },
      (err) => {
        setBusy(false);
        setError(err.code === err.PERMISSION_DENIED
          ? 'Location permission denied. Allow it in the address bar, or set coordinates manually.'
          : 'Could not get your location.');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }

  return (
    <section className="card">
      <h2>Your profile</h2>

      <label style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
        Name — used for the greeting on your dashboard
      </label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          className="input" value={value} placeholder="Usman Ali"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save({ display_name: value }); }}
          style={{ flex: '1 1 220px', minWidth: 0 }}
        />
        <button className="btn" disabled={busy || !value.trim()}
                onClick={() => save({ display_name: value })}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div style={{ marginTop: 20, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn secondary" onClick={useMyLocation} disabled={busy}>
          {hasLocation ? 'Update location' : 'Use my current location'}
        </button>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {hasLocation
            ? `${place ?? 'Location set'} · timezone ${timezone}`
            : 'Needed for weather and the what-to-wear line in your briefing.'}
        </span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.6 }}>
        Stored rounded to about 1&nbsp;km — enough for a forecast, no more precise than the job needs.
      </p>

      {saved && <p style={{ color: 'var(--good)', fontSize: 13, marginTop: 10 }}>Saved.</p>}
      {error && <p style={{ color: 'var(--critical)', fontSize: 13, marginTop: 10 }}>{error}</p>}
    </section>
  );
}
