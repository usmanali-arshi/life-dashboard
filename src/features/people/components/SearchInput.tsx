'use client';

import { useEffect, useState } from 'react';

interface Props {
  value: string;
  onChange: (q: string) => void;
}

const DEBOUNCE_MS = 300;

export function SearchInput({ value, onChange }: Props) {
  const [text, setText] = useState(value);
  useEffect(() => { setText(value); }, [value]);
  useEffect(() => {
    if (text === value) return;
    const t = setTimeout(() => onChange(text), DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <label className="pp-search">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
           strokeWidth="2" strokeLinecap="round" aria-hidden>
        <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
      </svg>
      <span className="pp-sr">Search people</span>
      <input
        type="search" value={text} placeholder="That stranger who became a friend…"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onChange(text); }}
      />
      {text && (
        <button type="button" className="pp-iconbtn" aria-label="Clear search"
                onClick={() => { setText(''); onChange(''); }}>✕</button>
      )}
    </label>
  );
}
