'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { reverseGeocode } from '@/lib/geo';

/**
 * Backfills the place name for a profile that already has coordinates.
 *
 * Anyone who granted location before location_name existed has lat/lon but no
 * label, and the grant prompt never reappears — so without this they'd have to
 * know to re-grant from Settings. Renders nothing, runs once, and stays quiet
 * on failure: a missing city name is a cosmetic problem, not worth an error.
 *
 * Uses no geolocation permission — it only reverse-geocodes coordinates the
 * user already gave us.
 */
export function ResolvePlace({ lat, lon }: { lat: number; lon: number }) {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      const place = await reverseGeocode(lat, lon);
      if (!place) return;
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_name: place }),
      });
      if (res.ok) router.refresh();
    })();
  }, [lat, lon, router]);

  return null;
}
