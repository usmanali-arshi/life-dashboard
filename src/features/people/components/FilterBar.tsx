'use client';

import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { localDayKey } from '../dates';
import type { Industry, Place } from '../types';
import { SearchInput } from './SearchInput';

type WhenKey = 'week' | 'month' | '3m' | 'year';
const WHEN: { key: WhenKey; label: string }[] = [
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: '3m', label: 'Last 3 months' },
  { key: 'year', label: 'This year' },
];

/** from/to as local floating dates for a preset. */
function whenRange(k: WhenKey): { from: string; to: string } {
  const to = localDayKey();
  if (k === 'week') return { from: localDayKey(-6), to };
  if (k === '3m') return { from: localDayKey(-90), to };
  if (k === 'month') return { from: `${to.slice(0, 7)}-01`, to };
  return { from: `${to.slice(0, 4)}-01-01`, to };
}

interface Props {
  places: Place[];
  industries: Industry[];
  industryColor: Map<string, number>;
}

export function FilterBar({ places, industries, industryColor }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const q = params.get('q') ?? '';
  const place = params.get('place') ?? '';
  const industry = params.get('industry') ?? '';
  const when = params.get('when') ?? '';
  const active = Boolean(q || place || industry || when);

  function update(patch: Record<string, string | null>) {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v); else p.delete(k);
    }
    // Changing a filter is a new view; the open card belongs to the old one.
    p.delete('person');
    const qs = p.toString();
    router.replace((qs ? `${pathname}?${qs}` : pathname) as Route, { scroll: false });
  }

  function setWhen(k: string) {
    if (!k) { update({ when: null, from: null, to: null }); return; }
    const r = whenRange(k as WhenKey);
    update({ when: k, from: r.from, to: r.to });
  }

  return (
    <div className="pp-filters">
      <SearchInput value={q} onChange={(v) => update({ q: v || null })} />

      <div className="pp-filter-row">
        <label className={place ? 'pp-select is-set' : 'pp-select'}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11Z" /><circle cx="12" cy="10" r="2.2" />
          </svg>
          <span className="pp-sr">Where</span>
          <select value={place} onChange={(e) => update({ place: e.target.value || null })}>
            <option value="">Where</option>
            {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>

        <label className={when ? 'pp-select is-set' : 'pp-select'}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" aria-hidden>
            <rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 10h18M8 3v4M16 3v4" />
          </svg>
          <span className="pp-sr">When</span>
          <select value={when} onChange={(e) => setWhen(e.target.value)}>
            <option value="">When</option>
            {WHEN.map((w) => <option key={w.key} value={w.key}>{w.label}</option>)}
          </select>
        </label>

        <div className="pp-chips" role="group" aria-label="Industry">
          {industries.map((i) => {
            const on = industry === i.id;
            return (
              <button key={i.id} type="button" aria-pressed={on}
                      className={`pp-chip ind-${industryColor.get(i.id) ?? 1}${on ? ' is-on' : ''}`}
                      onClick={() => update({ industry: on ? null : i.id })}>
                {i.name}
              </button>
            );
          })}
        </div>

        {active && (
          <button type="button" className="pp-chip dashed" onClick={() => router.replace(pathname as Route)}>
            Clear
          </button>
        )}

        <div className="pp-views" role="group" aria-label="View">
          <button type="button" className="is-on" aria-pressed>Wall</button>
          <button type="button" disabled title="Later">Map</button>
          <button type="button" disabled title="Later">Web</button>
        </div>
      </div>
    </div>
  );
}
