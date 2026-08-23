'use client';

import { useEffect, useState } from 'react';

interface Cred {
  provider: 'anthropic' | 'openai';
  key_hint: string;
  model: string | null;
  status: string;
}

const PROVIDERS = [
  {
    id: 'anthropic' as const,
    label: 'Anthropic (Claude)',
    keyUrl: 'https://console.claude.com/settings/keys',
    hint: 'sk-ant-…',
    models: [
      { id: 'claude-haiku-4-5', label: 'Haiku 4.5 — cheapest, plenty for this' },
      { id: 'claude-sonnet-5', label: 'Sonnet 5 — 2× Haiku' },
      { id: 'claude-opus-5', label: 'Opus 5 — 5× Haiku' },
    ],
  },
  {
    id: 'openai' as const,
    label: 'OpenAI',
    keyUrl: 'https://platform.openai.com/api-keys',
    hint: 'sk-…',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o mini — cheapest' },
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
      { id: 'gpt-4.1', label: 'GPT-4.1' },
    ],
  },
];

export function LlmSettings() {
  const [cred, setCred] = useState<Cred | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [provider, setProvider] = useState<'anthropic' | 'openai'>('anthropic');
  const [model, setModel] = useState(PROVIDERS[0].models[0].id);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/llm').then((r) => r.json()).then((d) => {
      setCred(d.credential);
      if (d.credential) {
        setProvider(d.credential.provider);
        setModel(d.credential.model ?? '');
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const current = PROVIDERS.find((p) => p.id === provider)!;

  async function save() {
    setBusy(true); setError(null); setSaved(false);
    const res = await fetch('/api/llm', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, api_key: key, model }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error ?? 'Could not save'); return; }
    setCred(data.credential);
    setKey('');                     // never keep it in component state
    setSaved(true);
  }

  async function remove() {
    setBusy(true);
    await fetch('/api/llm', { method: 'DELETE' });
    setBusy(false);
    setCred(null); setSaved(false);
  }

  return (
    <section className="card">
      <h2>Assistant (bring your own key)</h2>

      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: 0 }}>
        The &ldquo;Can I fit it in?&rdquo; panel works without a key — answers are computed
        straight from your calendar. Adding a key lets you ask in plain language and get a
        reply that weighs your tasks. <strong>Calls are billed to your key</strong>, typically
        well under a dollar a month on the cheapest model.
      </p>

      {loaded && cred && (
        <div className="banner good" style={{ marginBottom: 14 }}>
          <strong>{PROVIDERS.find((p) => p.id === cred.provider)?.label}</strong> connected
          {' '}(key ending <code>{cred.key_hint}</code>, model <code>{cred.model}</code>).
          <div style={{ marginTop: 8 }}>
            <button className="btn secondary" onClick={remove} disabled={busy}>
              Remove key
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select className="input" value={provider}
                  onChange={(e) => {
                    const p = e.target.value as 'anthropic' | 'openai';
                    setProvider(p);
                    setModel(PROVIDERS.find((x) => x.id === p)!.models[0].id);
                  }}>
            {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <select className="input" value={model} onChange={(e) => setModel(e.target.value)}
                  style={{ flex: '1 1 240px', minWidth: 0 }}>
            {current.models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            className="input" type="password" value={key} autoComplete="off"
            placeholder={`API key (${current.hint})`}
            onChange={(e) => setKey(e.target.value)}
            style={{ flex: '1 1 260px', minWidth: 0 }}
          />
          <button className="btn" onClick={save} disabled={busy || key.trim().length < 20}>
            {busy ? 'Verifying…' : cred ? 'Replace key' : 'Connect'}
          </button>
        </div>

        {error && <p style={{ color: 'var(--critical)', fontSize: 13, margin: 0 }}>{error}</p>}
        {saved && <p style={{ color: 'var(--good)', fontSize: 13, margin: 0 }}>
          Verified and saved.
        </p>}

        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
          Get a key at <a href={current.keyUrl} target="_blank" rel="noreferrer">{current.keyUrl}</a>.
          {' '}<strong>A ChatGPT or Claude subscription is not API access</strong> — those are
          separate products with separate billing, and you need a key from the developer platform.
          {' '}The key is verified before saving, encrypted at rest with AES-256-GCM, and never
          sent back to your browser afterwards.
        </p>
      </div>
    </section>
  );
}
