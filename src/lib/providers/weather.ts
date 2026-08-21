/**
 * Open-Meteo: free, no API key, no signup. Nothing to configure and nothing
 * to leak.
 */

export interface WeatherToday {
  tempMax: number;
  tempMin: number;
  feelsLikeMax: number;
  precipProbMax: number;
  precipMm: number;
  windMaxKph: number;
  code: number;
  hourly: { time: string; temp: number; precipProb: number }[];
}

const WMO: Record<number, string> = {
  0: 'clear', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast',
  45: 'foggy', 48: 'freezing fog', 51: 'light drizzle', 53: 'drizzle',
  55: 'heavy drizzle', 61: 'light rain', 63: 'rain', 65: 'heavy rain',
  71: 'light snow', 73: 'snow', 75: 'heavy snow', 80: 'rain showers',
  81: 'rain showers', 82: 'violent rain showers', 95: 'thunderstorms',
  96: 'thunderstorms with hail', 99: 'severe thunderstorms',
};

export const describeCode = (c: number) => WMO[c] ?? 'unsettled';

export async function fetchWeather(lat: number, lon: number, timezone: string): Promise<WeatherToday> {
  const p = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    timezone,
    forecast_days: '1',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_probability_max,precipitation_sum,wind_speed_10m_max',
    hourly: 'temperature_2m,precipitation_probability',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'kmh',
    precipitation_unit: 'mm',
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${p}`);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const d = await res.json();

  return {
    tempMax: d.daily.temperature_2m_max[0],
    tempMin: d.daily.temperature_2m_min[0],
    feelsLikeMax: d.daily.apparent_temperature_max[0],
    precipProbMax: d.daily.precipitation_probability_max[0] ?? 0,
    precipMm: d.daily.precipitation_sum[0] ?? 0,
    windMaxKph: d.daily.wind_speed_10m_max[0],
    code: d.daily.weather_code[0],
    hourly: (d.hourly?.time ?? []).map((t: string, i: number) => ({
      time: t,
      temp: d.hourly.temperature_2m[i],
      precipProb: d.hourly.precipitation_probability?.[i] ?? 0,
    })),
  };
}

export type TempUnit = 'C' | 'F';

/**
 * Weather is always FETCHED in Fahrenheit and converted for display.
 *
 * Storing one canonical unit means the dressAdvice thresholds below stay a
 * single set of numbers — duplicating them per unit is how you end up with
 * "wear a coat" firing at 45°C.
 */
export function displayTemp(tempF: number, unit: TempUnit): number {
  return unit === 'C' ? (tempF - 32) * (5 / 9) : tempF;
}

export const formatTemp = (tempF: number, unit: TempUnit) =>
  `${Math.round(displayTemp(tempF, unit))}°`;

/** The "what do I wear / do I need an umbrella" answer. */
export function dressAdvice(w: WeatherToday): string {
  const bits: string[] = [];
  const t = w.feelsLikeMax;

  if (t < 32) bits.push('heavy coat, hat and gloves');
  else if (t < 45) bits.push('winter coat');
  else if (t < 58) bits.push('a proper jacket');
  else if (t < 68) bits.push('a light jacket or layers');
  else if (t < 80) bits.push('no jacket needed');
  else bits.push('dress light, it will be hot');

  // Swing matters as much as the max — a 70°F afternoon after a 45°F morning
  // still calls for layers.
  if (w.tempMax - w.tempMin > 20) bits.push('big temperature swing today, so layer up');

  if (w.precipProbMax >= 60) bits.push(`umbrella — ${Math.round(w.precipProbMax)}% chance of rain`);
  else if (w.precipProbMax >= 30) bits.push(`maybe grab an umbrella (${Math.round(w.precipProbMax)}%)`);

  if (w.windMaxKph > 35) bits.push('windy, so an umbrella may lose that fight');

  return bits.join('; ');
}
