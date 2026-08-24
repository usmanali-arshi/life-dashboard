'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ListGroupSection, groupByList } from './ListGroup';
import type { TaskRow } from './TaskItem';

/**
 * One bucket of tasks (Overdue / Due today / Later) with multi-select.
 *
 * Selection is per-block on purpose. The blocks are the categories people
 * actually act on in bulk — "clear everything overdue", "tick off today" — and
 * a single global selection spanning three lists is far easier to fire
 * accidentally.
 */
export function TaskBlock({ title, subtitle, tasks, tz, tone, defaultOpen = true }: {
  title: string;
  /** e.g. "Tue, Aug 18" — anchors a relative heading to an actual date. */
  subtitle?: string;
  tasks: TaskRow[];
  tz: string;
  tone?: 'critical' | 'warning';
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [open, setOpen] = useState(defaultOpen);

  const open_ = tasks.filter((t) => !t.completed);
  const allSelected = open_.length > 0 && selected.size === open_.length;
  // The header counts what's IN the block. open_ drives selection only — using
  // it for the count meant "Completed today" always displayed (0), since every
  // task in that block is by definition completed.
  const shownCount = tasks.length;
  const groups = groupByList(tasks);

  function toggleOne(id: string, next: boolean) {
    setSelected((s) => {
      const copy = new Set(s);
      next ? copy.add(id) : copy.delete(id);
      return copy;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(open_.map((t) => t.id)));
  }

  async function markDone() {
    setBusy(true);
    setResult(null);
    const ids = [...selected];
    const res = await fetch('/api/tasks/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, completed: true }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok && !data.completed) {
      setResult(data.error ?? 'Could not complete those tasks.');
      return;
    }
    setSelected(new Set());
    // Name the failures — "18 of 20" with no detail is useless for fixing it.
    setResult(data.failed?.length
      ? `${data.completed} done · ${data.failed.length} failed: `
        + data.failed.slice(0, 2).map((f: any) => `${f.title} (${f.error})`).join('; ')
      : null);
    router.refresh();
  }

  if (!tasks.length) {
    return (
      <section className="card">
        <h2>
          {title}
          {subtitle && <span className="blockdate">{subtitle}</span>}
        </h2>
        <p className="empty">Nothing here.</p>
      </section>
    );
  }

  return (
    <section className="card" style={tone ? { borderColor: `var(--${tone})` } : undefined}>
      <div className="blockhead">
        <h2 style={{ margin: 0 }}>
          {title} <span className="count">({shownCount})</span>
          {subtitle && <span className="blockdate">{subtitle}</span>}
        </h2>
        <span style={{ flex: 1 }} />
        {open_.length > 0 && (
          <label className="selectall">
            <input type="checkbox" className="selectbox" checked={allSelected}
                   onChange={toggleAll} aria-label={`Select all in ${title}`} />
            Select all
          </label>
        )}
        <button className="linkbtn" onClick={() => setOpen((o) => !o)}>
          {open ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {selected.size > 0 && (
        <div className="bulkbar">
          <strong>{selected.size} selected</strong>
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={markDone} disabled={busy}>
            {busy ? 'Completing…' : `Mark ${selected.size} done`}
          </button>
          <button className="btn secondary" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}

      {result && (
        <p style={{ fontSize: 13, color: 'var(--critical)', margin: '0 0 10px' }}>{result}</p>
      )}

      {open && (
        <div className="grouplist">
          {groups.map((g) => (
            <ListGroupSection
              key={g.key} group={g} tz={tz}
              // One group means the heading would only repeat what the rows
              // already say. Show it from two upwards, where it earns its space
              // by separating them.
              showHeading={groups.length > 1}
              selected={selected}
              onSelect={toggleOne}
            />
          ))}
        </div>
      )}
    </section>
  );
}
