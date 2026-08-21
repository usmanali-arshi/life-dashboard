'use client';

import { useEffect } from 'react';

/** Registers the service worker. Skipped in dev, where it just fights HMR. */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Registration failure is not worth surfacing — the app works fine
      // without it, just without the offline fallback.
    });
  }, []);
  return null;
}
