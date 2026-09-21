import Link from 'next/link';
import { fmtMonth, monthKey } from '../dates';
import type { Contact } from '../types';
import { Polaroid } from './Polaroid';

interface Props {
  contacts: Contact[];
  placeName: Map<string, string>;
  industryName: Map<string, string>;
  photoUrl: Map<string, string>;
  /** Current query string (without '?'), so opening a card keeps filters. */
  query: string;
  filtered: boolean;
}

export function Wall({ contacts, placeName, industryName, photoUrl, query, filtered }: Props) {
  if (contacts.length === 0) {
    return (
      <div className="pp-empty">
        <p className="pp-empty-title">{filtered ? 'Hmm, no one matches.' : 'No one here yet.'}</p>
        {filtered
          ? <Link href="/people" className="pp-btn secondary">Clear filters</Link>
          : <p className="pp-empty-sub">Tap “Met someone” after your next coffee.</p>}
      </div>
    );
  }

  const groups = new Map<string, Contact[]>();
  for (const c of contacts) {
    const k = monthKey(c.met_on);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(c);
  }
  const hrefFor = (id: string) => {
    const p = new URLSearchParams(query);
    p.set('person', id);
    return `/people?${p.toString()}`;
  };

  return (
    <div className="pp-wall">
      {[...groups.entries()].map(([month, list]) => (
        <section key={month} className="pp-month" aria-label={fmtMonth(month)}>
          <h2 className="pp-month-label">
            {fmtMonth(month)} <span className="pp-month-count">· {list.length}</span>
          </h2>
          <div className="pp-grid">
            {list.map((c) => (
              <Polaroid
                key={c.id} contact={c} href={hrefFor(c.id)} photoUrl={photoUrl.get(c.id) ?? null}
                placeName={c.place_id ? placeName.get(c.place_id) ?? null : null}
                industryName={c.industry_id ? industryName.get(c.industry_id) ?? null : null}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
