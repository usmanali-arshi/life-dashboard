'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { ContactInput } from '../actions';
import { fmtMetOnLong } from '../dates';
import type { ActionResult, Contact, Industry, Place } from '../types';
import { ContactSheet } from './ContactSheet';
import { PinIcon, Polaroid } from './Polaroid';

interface Props {
  contact: Contact;
  place: Place | null;
  industry: Industry | null;
  alsoMet: { id: string; name: string }[];
  photoUrl: string | null;
  industries: Industry[];
  industryColor: Map<string, number>;
  existingNames: string[];
  onUpdate: (id: string, input: ContactInput) => Promise<ActionResult<Contact>>;
  onDelete: (id: string) => Promise<ActionResult<void>>;
  setPhoto: (id: string, form: FormData) => Promise<ActionResult<Contact>>;
  removePhoto: (id: string) => Promise<ActionResult<Contact>>;
}

const IG = (h: string) => `https://instagram.com/${h}`;

export function Drawer({ contact, place, industry, alsoMet, photoUrl, industries, industryColor, existingNames, onUpdate, onDelete, setPhoto, removePhoto }: Props) {
  const onPhoto = (id: string, blob: Blob | null) => {
    if (!blob) return removePhoto(id);
    const fd = new FormData();
    fd.append('photo', blob, 'photo.jpg');
    return setPhoto(id, fd);
  };
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => {
    const p = new URLSearchParams(params.toString());
    p.delete('person');
    const qs = p.toString();
    router.replace((qs ? `${pathname}?${qs}` : pathname) as Route, { scroll: false });
  }, [params, pathname, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !editing) close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, editing]);

  const linkFor = (id: string) => {
    const p = new URLSearchParams(params.toString());
    p.set('person', id);
    return `${pathname}?${p.toString()}` as Route;
  };

  async function remove() {
    setBusy(true); setError(null);
    const res = await onDelete(contact.id);
    setBusy(false);
    if (!res.ok) { setError(`Couldn’t delete: ${res.error}`); setConfirming(false); return; }
    close();
    router.refresh();
  }

  const details: [string, React.ReactNode][] = [];
  if (contact.company) details.push(['Company', contact.company]);
  if (contact.job_title) details.push(['Role', contact.job_title]);
  if (contact.phone_e164) details.push(['Phone', <a key="p" href={`tel:${contact.phone_e164}`}>{contact.phone_e164}</a>]);
  if (contact.instagram) details.push(['Instagram', <a key="i" href={IG(contact.instagram)} target="_blank" rel="noreferrer">@{contact.instagram}</a>]);
  if (contact.linkedin_url) details.push(['LinkedIn', <a key="l" href={contact.linkedin_url} target="_blank" rel="noreferrer">{contact.linkedin_url.replace(/^https?:\/\/(www\.)?/, '')}</a>]);
  if (place?.formatted_address) details.push(['Address', place.formatted_address]);

  return (
    <>
      <div className="pp-scrim pp-drawer-scrim" onClick={close}>
        <aside className="pp-drawer" role="dialog" aria-modal="true" aria-labelledby="pp-drawer-name"
               onClick={(e) => e.stopPropagation()}>
          <div className="pp-drawer-top">
            <button type="button" className="pp-iconbtn" aria-label="Close" onClick={close}>✕</button>
          </div>

          <div className="pp-drawer-hero">
            <Polaroid contact={contact} placeName={place?.name ?? null} industryName={null} photoUrl={photoUrl} size="drawer" tilt={-3} />
            <div className="pp-drawer-id">
              <h2 id="pp-drawer-name">{contact.name}</h2>
              {(contact.job_title || contact.company) && (
                <p className="pp-drawer-role">
                  {contact.job_title}{contact.job_title && contact.company ? ' · ' : ''}{contact.company}
                </p>
              )}
              {industry && <span className={`pp-pill ind-${industryColor.get(industry.id) ?? 1}`}>{industry.name}</span>}
            </div>
          </div>

          <div className="pp-drawer-where">
            <PinIcon />
            <span>
              {place ? <strong>{place.name}</strong> : <span className="pp-muted">Somewhere</span>}
              {place?.neighborhood && <span className="pp-muted"> · {place.neighborhood}</span>}
              <span className="pp-muted"> · {fmtMetOnLong(contact.met_on)}</span>
            </span>
          </div>

          {(contact.phone_e164 || contact.instagram || contact.linkedin_url) && (
            <div className="pp-drawer-actions">
              {contact.phone_e164 && <a className="pp-btn secondary" href={`tel:${contact.phone_e164}`}>Call</a>}
              {contact.instagram && <a className="pp-btn secondary" href={IG(contact.instagram)} target="_blank" rel="noreferrer">Instagram</a>}
              {contact.linkedin_url && <a className="pp-btn secondary" href={contact.linkedin_url} target="_blank" rel="noreferrer">LinkedIn</a>}
            </div>
          )}

          <div className="pp-notes">
            {contact.notes ? contact.notes : <span className="pp-muted">No notes yet.</span>}
          </div>

          {details.length > 0 && (
            <dl className="pp-details">
              {details.map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
          )}

          {place && alsoMet.length > 0 && (
            <div className="pp-also">
              <p className="pp-also-label">Also met at {place.name}</p>
              <div className="pp-chips">
                {alsoMet.map((a) => (
                  <Link key={a.id} href={linkFor(a.id)} className="pp-chip" scroll={false}>{a.name}</Link>
                ))}
              </div>
            </div>
          )}

          {error && <p className="pp-error" role="alert">{error}</p>}

          <div className="pp-drawer-foot">
            <button type="button" className="pp-btn secondary" onClick={() => setEditing(true)}>Edit</button>
            {confirming ? (
              <span className="pp-confirm">
                <span>Delete {contact.name}?</span>
                <button type="button" className="pp-btn danger" disabled={busy} onClick={() => void remove()}>
                  {busy ? 'Deleting…' : 'Yes, delete'}
                </button>
                <button type="button" className="pp-btn secondary" onClick={() => setConfirming(false)}>Keep</button>
              </span>
            ) : (
              <button type="button" className="pp-btn secondary pp-danger-text" onClick={() => setConfirming(true)}>
                Delete
              </button>
            )}
          </div>
        </aside>
      </div>

      {editing && (
        <ContactSheet
          open onClose={() => setEditing(false)}
          industries={industries} industryColor={industryColor} existingNames={existingNames}
          initial={{ contact, place: place ? { placeId: place.id, name: place.name } : null, photoUrl }}
          onSubmit={(input) => onUpdate(contact.id, input)} onPhoto={onPhoto}
          onSaved={(_c, _a, warning) => { setEditing(false); setError(warning ?? null); router.refresh(); }}
        />
      )}
    </>
  );
}
