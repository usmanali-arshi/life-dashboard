/** Google Places API (New) client. Server-only: the key never reaches the browser. */

const NYC = { latitude: 40.7128, longitude: -74.006 };
const RADIUS_M = 50000;

export interface Prediction {
  placeId: string;
  mainText: string;
  secondaryText: string | null;
}

export interface PlaceDetails {
  placeId: string;
  formattedAddress: string | null;
  neighborhood: string | null;
  lat: number | null;
  lng: number | null;
}

export const placesConfigured = () => Boolean(process.env.GOOGLE_PLACES_API_KEY);

function key(): string {
  const k = process.env.GOOGLE_PLACES_API_KEY;
  if (!k) throw new Error('GOOGLE_PLACES_API_KEY is not set');
  return k;
}

interface AutocompleteResponse {
  suggestions?: {
    placePrediction?: {
      placeId: string;
      text?: { text: string };
      structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
    };
  }[];
}

export async function autocomplete(input: string, sessionToken: string): Promise<Prediction[]> {
  const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key() },
    body: JSON.stringify({
      input, sessionToken,
      locationBias: { circle: { center: NYC, radius: RADIUS_M } },
    }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Places autocomplete ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as AutocompleteResponse;
  return (data.suggestions ?? []).flatMap((s) => {
    const p = s.placePrediction;
    if (!p) return [];
    return [{
      placeId: p.placeId,
      mainText: p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
      secondaryText: p.structuredFormat?.secondaryText?.text ?? null,
    }];
  });
}

interface DetailsResponse {
  id: string;
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  addressComponents?: { longText: string; types: string[] }[];
}

export async function details(placeId: string, sessionToken: string): Promise<PlaceDetails> {
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`;
  const res = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': key(),
      'X-Goog-FieldMask': 'id,formattedAddress,location,addressComponents',
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Places details ${res.status}: ${await res.text()}`);
  const d = (await res.json()) as DetailsResponse;
  const comp = (type: string) => d.addressComponents?.find((c) => c.types.includes(type))?.longText ?? null;
  return {
    placeId: d.id,
    formattedAddress: d.formattedAddress ?? null,
    neighborhood: comp('neighborhood') ?? comp('sublocality_level_1'),
    lat: d.location?.latitude ?? null,
    lng: d.location?.longitude ?? null,
  };
}
