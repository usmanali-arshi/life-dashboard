'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ContactInput } from '../actions';
import type { ActionResult, Contact, Industry } from '../types';
import { PlaceInput, type PlaceValue } from './PlaceInput';

type Optional = 'industry' | 'role' | 'company' | 'instagram' | 'linkedin' | 'phone';
const OPTIONAL: { key: Optional; label: string }[] = [
  { key: 'industry', label: 'Industry' },
  { key: 'role', label: 'Role' },
  { key: 'company', label: 'Company' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'phone', label: 'Phone' },
];
const NEW_INDUSTRY = '__new__';

/** Local floating date, 'YYYY-MM-DD'. Browser zone is the user's zone. */
const dayKey = (offsetDays = 0) =>
  new Date(Date.now() + offsetDays * 864e5).toLocaleDateString('en-CA');

interface Props {
  industries: Industry[];
  existingNames: string[];
  defaultPlace: PlaceValue | null;
  onCreate: (input: ContactInput) => Promise<ActionResult<Contact>>;
}

export function QuickAddSheet({ industries, existingNames, defaultPlace, onCreate }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const openedByUrl = params.get('add') === '1';

  const [open, setOpen] = useState(openedByUrl);
  useEffect(() => { if (openedByUrl) setOpen(true); }, [openedByUrl]);

  const [name, setName] = useState('');
  const [when, setWhen] = useState<'today' | 'yesterday' | 'date'>('today');
  const [date, setDate] = useState(dayKey());
  const [place, setPlace] = useState<PlaceValue | null>(defaultPlace);
  const [notes, setNotes] = useState('');
  const [shown, setShown] = useState<Set<Optional>>(new Set());
  const [industryId, setIndustryId] = useState('');
  const [industryName, setIndustryName] = useState('');
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [instagram, setInstagram] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) nameRef.current?.focus(); }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const nearMatch = useMemo(() => {
    const n = name.trim().toLowerCase();
    if (n.length < 3) return null;
    return existingNames.find((e) => {
      const x = e.toLowerCase();
      return x === n || x.includes(n) || n.includes(x);
    }) ?? null;
  }, [name, existingNames]);

  function close() {
    setOpen(false);
    setError(null);
    if (openedByUrl) router.replace('/people');
  }

  function metOn() {
    return when === 'today' ? dayKey() : when === 'yesterday' ? dayKey(-1) : date;
  }

  /** Clears everything except date and place, which stay sticky for "add another". */
  function resetRest() {
    setName(''); setNotes(''); setShown(new Set());
    setIndustryId(''); setIndustryName(''); setRole(''); setCompany('');
    setInstagram(''); setLinkedin(''); setPhone('');
  }

  async function save(addAnother: boolean) {
    setBusy(true); setError(null);
    const res = await onCreate({
      name, met_on: metOn(),
      place_id: place?.placeId ?? null,
      place_name: place?.placeId ? null : place?.name ?? null,
      industry_id: industryId && industryId !== NEW_INDUSTRY ? industryId : null,
      industry_name: industryId === NEW_INDUSTRY ? industryName : null,
      job_title: role, company, instagram, linkedin_url: linkedin, phone, notes,
    });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    setFlash(`Added ${res.data.name}`);
    resetRest();
    if (addAnother) nameRef.current?.focus();
    else close();
    router.refresh();
  }

  const reveal = (k: Optional) => setShown((s) => new Set(s).add(k));

  return (
    <>
      <span className="pp-addwrap">
        {flash && !open && (
          <span className="pp-flash" role="status">
            {flash}
            <button type="button" className="pp-iconbtn" aria-label="Dismiss"
                    onClick={() => setFlash(null)}>✕</button>
          </span>
        )}
        <button type="button" className="pp-btn" onClick={() => { setFlash(null); setOpen(true); }}>
          Met someone
        </button>
      </span>

      {open && (
        <div className="pp-scrim" onClick={close}>
          <form
            className="pp-sheet" role="dialog" aria-modal="true" aria-labelledby="pp-add-title"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); void save(false); }}
          >
            <div className="pp-sheet-head">
              <h2 id="pp-add-title">Met someone</h2>
              <button type="button" className="pp-iconbtn" aria-label="Close" onClick={close}>✕</button>
            </div>

            <label className="pp-field">
              <span>Name</span>
              <input ref={nameRef} className="pp-input" value={name} required
                     placeholder="Who did you meet?" onChange={(e) => setName(e.target.value)} />
            </label>
            {nearMatch && (
              <p className="pp-warn" role="status">
                Looks like you already have <strong>{nearMatch}</strong>. Saving anyway is fine.
              </p>
            )}

            <fieldset className="pp-field">
              <legend>When</legend>
              <div className="pp-seg" role="group">
                {(['today', 'yesterday', 'date'] as const).map((k) => (
                  <button key={k} type="button" aria-pressed={when === k}
                          className={when === k ? 'is-on' : undefined}
                          onClick={() => setWhen(k)}>
                    {k === 'today' ? 'Today' : k === 'yesterday' ? 'Yesterday' : 'Pick a date'}
                  </button>
                ))}
              </div>
              {when === 'date' && (
                <input className="pp-input" type="date" value={date} max={dayKey()}
                       aria-label="Date met" onChange={(e) => setDate(e.target.value)} />
              )}
            </fieldset>

            <div className="pp-field">
              <span id="pp-where-label">Where</span>
              <div aria-labelledby="pp-where-label">
                <PlaceInput value={place} onChange={setPlace} placeholder="Bar, party, office…" />
              </div>
            </div>

            <label className="pp-field">
              <span>Notes</span>
              <textarea className="pp-input" rows={3} value={notes}
                        placeholder="What did you talk about?"
                        onChange={(e) => setNotes(e.target.value)} />
            </label>

            <div className="pp-chips">
              {OPTIONAL.filter((o) => !shown.has(o.key)).map((o) => (
                <button key={o.key} type="button" className="pp-chip dashed"
                        onClick={() => reveal(o.key)}>+ {o.label}</button>
              ))}
            </div>

            {shown.has('industry') && (
              <label className="pp-field">
                <span>Industry</span>
                <select className="pp-input" value={industryId} autoFocus
                        onChange={(e) => setIndustryId(e.target.value)}>
                  <option value="">—</option>
                  {industries.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  <option value={NEW_INDUSTRY}>+ New industry…</option>
                </select>
                {industryId === NEW_INDUSTRY && (
                  <input className="pp-input" value={industryName} placeholder="Industry name"
                         aria-label="New industry name" autoFocus
                         onChange={(e) => setIndustryName(e.target.value)} />
                )}
              </label>
            )}
            {shown.has('role') && (
              <label className="pp-field"><span>Role</span>
                <input className="pp-input" value={role} autoFocus onChange={(e) => setRole(e.target.value)} />
              </label>
            )}
            {shown.has('company') && (
              <label className="pp-field"><span>Company</span>
                <input className="pp-input" value={company} autoFocus onChange={(e) => setCompany(e.target.value)} />
              </label>
            )}
            {shown.has('instagram') && (
              <label className="pp-field"><span>Instagram</span>
                <input className="pp-input" value={instagram} placeholder="handle" autoFocus
                       onChange={(e) => setInstagram(e.target.value)} />
              </label>
            )}
            {shown.has('linkedin') && (
              <label className="pp-field"><span>LinkedIn</span>
                <input className="pp-input" value={linkedin} placeholder="URL or /in/ handle" autoFocus
                       onChange={(e) => setLinkedin(e.target.value)} />
              </label>
            )}
            {shown.has('phone') && (
              <label className="pp-field"><span>Phone</span>
                <input className="pp-input" type="tel" value={phone} autoFocus
                       onChange={(e) => setPhone(e.target.value)} />
              </label>
            )}

            {error && <p className="pp-error" role="alert">Couldn’t save: {error}</p>}

            <div className="pp-sheet-actions">
              <button type="button" className="pp-btn secondary" disabled={busy || !name.trim()}
                      onClick={() => void save(true)}>
                Save &amp; add another
              </button>
              <button type="submit" className="pp-btn" disabled={busy || !name.trim()}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
