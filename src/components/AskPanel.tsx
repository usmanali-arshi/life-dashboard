'use client';

import { useRef, useState } from 'react';

interface Turn { role: 'user' | 'assistant'; content: string; source?: string; }

const EXAMPLES = [
  'Can I fit the gym in today?',
  'Do I have 3 hours for board games this week?',
  'When can I explore the city with friends?',
  'Should I do groceries tonight or tomorrow?',
];

/**
 * Scheduling chat on the Overview.
 *
 * The slot arithmetic happens server-side and deterministically; this is purely
 * transport and presentation. It works with no API key configured — the reply
 * is then rule-generated, and a hint points at the settings page.
 */
export function AskPanel({ freeToday }: { freeToday: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    setQ('');
    setNotice(null);
    setTurns((t) => [...t, { role: 'user', content: text }]);
    setBusy(true);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          // Only prior turns, so the server never re-sends its own context blob.
          history: turns.map((t) => ({ role: t.role, content: t.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong');

      setTurns((t) => [...t, {
        role: 'assistant', content: data.answer, source: data.source,
      }]);
      if (data.warning) setNotice(data.warning);
      else if (data.hint) setNotice(data.hint);
    } catch (e) {
      setTurns((t) => [...t, {
        role: 'assistant',
        content: e instanceof Error ? e.message : 'Something went wrong.',
      }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <section className="card ask">
      <div className="blockhead">
        <h2 style={{ margin: 0 }}>Can I fit it in?</h2>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{freeToday} free today</span>
      </div>

      {turns.length === 0 ? (
        <div className="ask-empty">
          <p>
            Ask whether something fits around your meetings, and what it costs you
            in task time.
          </p>
          <div className="ask-chips">
            {EXAMPLES.map((e) => (
              <button key={e} className="ask-chip" onClick={() => ask(e)} disabled={busy}>
                {e}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="ask-thread">
          {turns.map((t, i) => (
            <div key={i} className={t.role === 'user' ? 'ask-turn me' : 'ask-turn'}>
              <span className="bubble">{t.content}</span>
              {t.role === 'assistant' && t.source === 'rules' && (
                <span className="ask-src">computed from your calendar</span>
              )}
            </div>
          ))}
          {busy && <div className="ask-turn"><span className="bubble muted">Thinking…</span></div>}
        </div>
      )}

      {notice && (
        <p className="ask-notice">
          {notice}
          {/connect an api key/i.test(notice) && <> <a href="/settings">Set one up →</a></>}
        </p>
      )}

      <form className="ask-form" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
        <input
          ref={inputRef} className="input" value={q} maxLength={500}
          placeholder="Can I fit a 2-hour gym session before Friday?"
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn" type="submit" disabled={busy || !q.trim()}>Ask</button>
        {turns.length > 0 && (
          <button className="linkbtn" type="button" onClick={() => { setTurns([]); setNotice(null); }}>
            Clear
          </button>
        )}
      </form>
    </section>
  );
}
