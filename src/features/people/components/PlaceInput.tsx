'use client';

import { useEffect, useId, useRef, useState } from 'react';

export interface PlaceValue {
  /** Set when the place is a saved people.places row. */
  placeId?: string;
  name: string;
}

interface OwnHit { id: string; name: string; neighborhood: string | null }
interface GoogleHit { placeId: string; mainText: string; secondaryText: string | null }
type Item =
  | { kind: 'own'; hit: OwnHit }
  | { kind: 'google'; hit: GoogleHit }
  | { kind: 'typed'; text: string };

interface Props {
  value: PlaceValue | null;
  onChange: (v: PlaceValue | null) => void;
  placeholder?: string;
}

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;

export function PlaceInput({ value, onChange, placeholder }: Props) {
  const [text, setText] = useState(value?.name ?? '');
  const [own, setOwn] = useState<OwnHit[]>([]);
  const [google, setGoogle] = useState<GoogleHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [resolving, setResolving] = useState(false);
  const session = useRef<string>(crypto.randomUUID());
  const listId = useId();

  useEffect(() => { setText(value?.name ?? ''); }, [value?.name]);

  useEffect(() => {
    if (value?.placeId) {
      // Text matching the pick is the pick echoing back — nothing to search.
      if (text === value.name) return;
      // Typing after a selection means the user is searching again — drop the pick.
      onChange(text ? { name: text } : null);
    }
    if (text.trim().length < MIN_CHARS) { setOwn([]); setGoogle([]); return; }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch('/api/people/places/autocomplete', {
          method: 'POST', signal: ctl.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: text.trim(), sessionToken: session.current }),
        });
        if (!res.ok) return;
        const d = await res.json();
        setOwn(d.own ?? []); setGoogle(d.google ?? []); setActive(0);
      } catch { /* aborted or offline: keep whatever is showing */ }
    }, DEBOUNCE_MS);
    return () => { clearTimeout(t); ctl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const typed = text.trim();
  const items: Item[] = [
    ...own.map((hit): Item => ({ kind: 'own', hit })),
    ...google.map((hit): Item => ({ kind: 'google', hit })),
    ...(typed.length >= MIN_CHARS && !own.some((o) => o.name.toLowerCase() === typed.toLowerCase())
      ? [{ kind: 'typed', text: typed } as Item] : []),
  ];
  const showList = open && items.length > 0 && !value?.placeId;

  async function pick(item: Item) {
    setOpen(false);
    if (item.kind === 'own') {
      onChange({ placeId: item.hit.id, name: item.hit.name });
    } else if (item.kind === 'typed') {
      onChange({ name: item.text });
    } else {
      setResolving(true);
      try {
        const q = new URLSearchParams({
          id: item.hit.placeId, name: item.hit.mainText, sessionToken: session.current,
        });
        const res = await fetch(`/api/people/places/details?${q}`);
        const d = await res.json();
        if (res.ok && d.place) onChange({ placeId: d.place.id, name: d.place.name });
        else onChange({ name: item.hit.mainText });
      } catch {
        onChange({ name: item.hit.mainText });
      } finally {
        setResolving(false);
      }
    }
    // A pick ends the Google billing session; the next search starts a fresh one.
    session.current = crypto.randomUUID();
    setOwn([]); setGoogle([]);
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showList) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); void pick(items[active]); }
    else if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); }
  }

  const optId = (i: number) => `${listId}-${i}`;

  return (
    <div className="pp-combo">
      <input
        className="pp-input" value={text} placeholder={placeholder}
        role="combobox" aria-expanded={showList} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={showList ? optId(active) : undefined}
        onChange={(e) => { setText(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKey}
      />
      {value?.placeId && <span className="pp-combo-tick" aria-label="Saved place">✓</span>}
      {resolving && <span className="pp-combo-hint">Saving place…</span>}
      {showList && (
        <ul className="pp-combo-list" id={listId} role="listbox">
          {items.map((item, i) => {
            const isActive = i === active;
            const cls = isActive ? 'is-active' : undefined;
            const props = {
              role: 'option' as const, 'aria-selected': isActive, id: optId(i), className: cls,
              onMouseDown: (e: React.MouseEvent) => { e.preventDefault(); void pick(item); },
              onMouseEnter: () => setActive(i),
            };
            if (item.kind === 'own') return (
              <li key={`o${item.hit.id}`} {...props}>
                <span className="pp-combo-main">{item.hit.name}</span>
                {item.hit.neighborhood && <span className="pp-combo-sub">{item.hit.neighborhood}</span>}
              </li>
            );
            if (item.kind === 'google') return (
              <li key={`g${item.hit.placeId}`} {...props}>
                <span className="pp-combo-main">{item.hit.mainText}</span>
                {item.hit.secondaryText && <span className="pp-combo-sub">{item.hit.secondaryText}</span>}
                {item.hit === google[google.length - 1] && (
                  <span className="pp-combo-credit" aria-hidden>Powered by Google</span>
                )}
              </li>
            );
            return (
              <li key="typed" {...props}>
                <span className="pp-combo-main">Use “{item.text}” as typed</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
