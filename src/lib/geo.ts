/**
 * Reverse-geocode coordinates to a place name, in the browser.
 *
 * BigDataCloud's client endpoint is free, needs no key, and is CORS-enabled for
 * exactly this. Called from the client so the user's coordinates go straight
 * from their browser to the geocoder — our server only ever receives the
 * resulting city name plus the rounded lat/lon.
 *
 * Best-effort: a failure just means the header shows coordinates instead.
 */
/**
 * Geocoders return the ISO 3166 *official* country name, which includes the
 * definite article in brackets — "United States of America (the)", "Netherlands
 * (the)", "Philippines (the)". Correct, and absurd in a dashboard header.
 */
const SHORT_NAMES: Record<string, string> = {
  US: 'USA', GB: 'UK', AE: 'UAE',
  KR: 'South Korea', KP: 'North Korea',
  RU: 'Russia', VN: 'Vietnam', SY: 'Syria', LA: 'Laos',
  BO: 'Bolivia', VE: 'Venezuela', TZ: 'Tanzania', IR: 'Iran',
  MD: 'Moldova', CZ: 'Czechia', MK: 'North Macedonia',
};

export function tidyCountry(name?: string | null, code?: string | null): string | null {
  if (code && SHORT_NAMES[code]) return SHORT_NAMES[code];
  if (!name) return null;
  return name
    .replace(/\s*\((the|The)\)\s*$/, '')       // "Netherlands (the)"
    .replace(/^The\s+/i, '')                    // "The Gambia"
    .replace(/\s*\[.*?\]\s*$/, '')              // bracketed qualifiers
    .trim() || null;
}

export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const url = 'https://api.bigdatacloud.net/data/reverse-geocode-client'
      + `?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const d = await res.json();
    // City and country only — deliberately coarse. Neighbourhood-level detail
    // is more precision than a weather forecast needs and more than belongs on
    // a screen someone might be sharing.
    const city = d.city || d.locality || d.principalSubdivision;
    return [city, tidyCountry(d.countryName, d.countryCode)].filter(Boolean).join(', ') || null;
  } catch {
    return null;
  }
}
