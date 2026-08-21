'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { reverseGeocode } from '@/lib/geo';

/**
 * Asks for coarse location so weather works, instead of making the user find
 * their own lat/lon.
 *
 * Deliberately does NOT call getCurrentPosition on mount — an unexplained
 * browser permission prompt the instant a page loads is the fastest way to get
 * a permanent "Block". The user clicks first, so they know what's being asked
 * and why.
 */
export function LocationPrompt() {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'busy' | 'error' | 'denied'>('idle');
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  function ask() {
    if (!navigator.geolocation) { setState('error'); return; }
    setState('busy');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        // Resolved in the browser, so precise coordinates never touch our
        // server — it only receives the city name and a rounded position.
        const place = await reverseGeocode(latitude, longitude);
        const res = await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat: latitude,
            lon: longitude,
            location_name: place ?? undefined,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        });
        if (res.ok) { setDismissed(true); router.refresh(); }
        else setState('error');
      },
      (err) => setState(err.code === err.PERMISSION_DENIED ? 'denied' : 'error'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }

  return (
    <div className="banner" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ flex: 1, minWidth: 200 }}>
        {state === 'denied'
          ? <>Location permission was denied. Allow it from the icon in your address bar, or set it on the <a href="/settings">Accounts</a> page.</>
          : state === 'error'
            ? <>Couldn&rsquo;t read your location. You can set it on the <a href="/settings">Accounts</a> page.</>
            : <><strong>Turn on weather?</strong> Your briefing can tell you what to wear and whether to take an umbrella. Stored rounded to about 1&nbsp;km.</>}
      </span>
      {state !== 'denied' && (
        <button className="btn" onClick={ask} disabled={state === 'busy'}>
          {state === 'busy' ? 'Locating…' : 'Use my location'}
        </button>
      )}
      <button className="btn secondary" onClick={() => setDismissed(true)}>Not now</button>
    </div>
  );
}
