'use client';

import { useEffect, useRef, useState } from 'react';
import { compressPhoto } from './compress';

export const CameraIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.2-2h5.6L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z" />
    <circle cx="12" cy="13" r="3.2" />
  </svg>
);

/** What the sheet holds: nothing changed, a new compressed blob, or "remove the existing one". */
export type PhotoChange = { kind: 'none' } | { kind: 'set'; blob: Blob } | { kind: 'remove' };

interface Props {
  /** Signed URL of the photo already stored, if any. */
  existingUrl: string | null;
  value: PhotoChange;
  onChange: (v: PhotoChange) => void;
  autoOpen?: boolean;
}

export function PhotoInput({ existingUrl, value, onChange, autoOpen }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (autoOpen) inputRef.current?.click(); }, [autoOpen]);

  useEffect(() => {
    if (value.kind !== 'set') { setPreview(null); return; }
    const url = URL.createObjectURL(value.blob);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true); setError(null);
    try {
      onChange({ kind: 'set', blob: await compressPhoto(file) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that photo');
    } finally {
      setBusy(false);
    }
  }

  const shown = value.kind === 'set' ? preview : value.kind === 'remove' ? null : existingUrl;

  return (
    <div className="pp-field">
      <span>Photo</span>
      <div className="pp-photo-row">
        <div className="pp-photo-thumb" aria-hidden>
          {shown ? <img src={shown} alt="" /> : <CameraIcon />}
        </div>
        <div className="pp-photo-btns">
          <button type="button" className="pp-chip" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? 'Processing…' : shown ? 'Retake' : 'Take photo'}
          </button>
          {shown && (
            <button type="button" className="pp-chip dashed"
                    onClick={() => onChange(existingUrl ? { kind: 'remove' } : { kind: 'none' })}>
              Remove
            </button>
          )}
        </div>
      </div>
      {/* capture="user" opens the front camera on phones; desktops fall back to a file picker. */}
      <input ref={inputRef} type="file" accept="image/*" capture="user" className="pp-sr"
             tabIndex={-1} aria-hidden onChange={onFile} />
      {error && <p className="pp-error" role="alert">{error}</p>}
    </div>
  );
}
