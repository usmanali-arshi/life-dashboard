import {
  describeCode, dressAdvice, formatTemp, type TempUnit, type WeatherToday,
} from '@/lib/providers/weather';
import { UnitToggle } from './UnitToggle';

/**
 * Today's weather and what to wear.
 *
 * Not a chart: a handful of scalars plus one sentence of advice. The hourly
 * strip is a sparkline-style rail, not a plot — no axes, because the exact
 * numbers don't matter, only the shape of the day.
 */
export function WeatherPanel({ weather, place, unit = 'F' }: {
  weather: WeatherToday | null; place: string | null; unit?: TempUnit;
}) {
  if (!weather) {
    return (
      <section className="card weather">
        <h2>Weather</h2>
        <p className="empty">
          Set your location on the <a href="/settings">Accounts</a> page to switch this on.
        </p>
      </section>
    );
  }

  const rain = Math.round(weather.precipProbMax);
  // Only the daytime hours are worth showing; nobody plans around 3am.
  const hours = weather.hourly.filter((h) => {
    const hh = Number(h.time.slice(11, 13));
    return hh >= 7 && hh <= 21;
  });
  const temps = hours.map((h) => h.temp);
  const lo = Math.min(...temps, weather.tempMin);
  const hi = Math.max(...temps, weather.tempMax);
  const span = Math.max(1, hi - lo);

  return (
    <section className="card weather">
      <div className="blockhead">
        {/* City only here — the country is already in the page header, and the
            full string wraps this heading onto three lines. */}
        <h2 style={{ margin: 0 }}>
          Weather{place ? ` · ${place.split(',')[0]}` : ''}
        </h2>
        <span style={{ flex: 1 }} />
        <UnitToggle unit={unit} />
      </div>

      <div className="wx-head">
        <span className="wx-temp">{formatTemp(weather.tempMax, unit)}</span>
        <span className="wx-meta">
          <span className="wx-cond">{describeCode(weather.code)}</span>
          <span className="wx-range">
            Low {formatTemp(weather.tempMin, unit)} · feels {formatTemp(weather.feelsLikeMax, unit)}
          </span>
        </span>
      </div>

      <p className="wx-advice">{dressAdvice(weather)}.</p>

      {hours.length > 0 && (
        <div className="wx-strip" aria-hidden>
          {hours.map((h) => (
            <span key={h.time} className="wx-bar"
                  title={`${h.time.slice(11, 16)} · ${formatTemp(h.temp, unit)} · ${h.precipProb}% rain`}>
              <span className="fill" style={{ height: `${((h.temp - lo) / span) * 100}%` }} />
              {h.precipProb >= 40 && <span className="wet" />}
            </span>
          ))}
        </div>
      )}
      <div className="wx-legend">
        <span>7am</span>
        <span>{rain >= 30 ? `${rain}% rain` : 'dry'}</span>
        <span>9pm</span>
      </div>
    </section>
  );
}
