'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { dueInputValue } from '@/lib/dates';
import { DoneButton, DuePill, accountTint, rowClass } from './ui';

export interface TaskRow {
  id: string;
  title: string;
  notes: string | null;
  due: string | null;
  completed: boolean;
  project_name: string | null;
  url: string | null;
  source?: string;
  /** Provider-side ids, needed to rename the owning list. Null for local tasks. */
  linked_account_id?: string | null;
  external_list_id?: string | null;
  linked_accounts: { label: string | null; email: string; color: string } | null;
}


export function TaskItem({ task, tz, selectable, selected, onSelect }: {
  task: TaskRow;
  tz: string;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string, next: boolean) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? '');
  const [due, setDue] = useState(dueInputValue(task.due));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Optimistic tick — the round trip includes a call to Google, so waiting for
  // it makes the checkbox feel broken.
  const [done, setDone] = useState(task.completed);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? 'Failed to save'); return false; }
    router.refresh();
    return true;
  }

  async function toggle() {
    const next = !done;
    setDone(next);
    const ok = await patch({ completed: next });
    if (!ok) setDone(!next);
  }

  async function save() {
    const ok = await patch({
      title,
      notes: notes || null,
      due: due || null,
    });
    if (ok) setEditing(false);
  }

  if (editing) {
    return (
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'grid', gap: 8, flex: 1, minWidth: 240 }}>
          <input className="input" value={title} autoFocus
                 onChange={(e) => setTitle(e.target.value)}
                 onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }} />
          <textarea className="input" value={notes} rows={2} placeholder="Notes"
                    onChange={(e) => setNotes(e.target.value)}
                    style={{ resize: 'vertical', fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="field">
              <span className="field-label">Due date</span>
              <input className="input" type="date" value={due}
                     onChange={(e) => setDue(e.target.value)} />
            </label>
            {due && (
              <button className="linkbtn" type="button" onClick={() => setDue('')}>
                Clear date
              </button>
            )}
            <span style={{ flex: 1 }} />
            <button className="btn" onClick={save} disabled={busy || !title.trim()}>
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button className="btn secondary" onClick={() => setEditing(false)}>Cancel</button>
          </div>
          {error && <span style={{ color: 'var(--critical)', fontSize: 13 }}>{error}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className={done ? 'row' : rowClass(task.due, tz)}
         style={accountTint(task.linked_accounts?.color)}>
      {/* LEFT: square checkbox = select for bulk actions. */}
      {selectable && (
        <input
          type="checkbox" className="selectbox" checked={!!selected}
          aria-label={`Select ${task.title}`}
          onChange={(e) => onSelect?.(task.id, e.target.checked)}
        />
      )}
      <span className="main-col">
        <span className={done ? 't done' : 't'}>
          {task.url && !done
            ? <a href={task.url} target="_blank" rel="noreferrer">{task.title}</a>
            : task.title}
        </span>
        {/* Account first, with its identity dot; list second, in muted text.
            "Noon · Personal" was ambiguous when an account and a task list
            share a name — the dot and the ordering now say which is which. */}
        <span className="s meta">
          {task.linked_accounts && (
            <span className="acct">
              <span className="dot sm" style={{ background: task.linked_accounts.color }} aria-hidden />
              {task.linked_accounts.label ?? task.linked_accounts.email}
            </span>
          )}
          {task.project_name && <span className="list">{task.project_name}</span>}
          {task.source === 'local' && <span className="list">local</span>}
        </span>
        {task.notes && <span className="s" style={{ whiteSpace: 'normal' }}>{task.notes}</span>}
        {error && <span className="s" style={{ color: 'var(--critical)' }}>{error}</span>}
      </span>
      {!done && <DuePill due={task.due} tz={tz} />}
      <button className="linkbtn" onClick={() => setEditing(true)}>Edit</button>
      {/* RIGHT: round button with a word = complete. */}
      <DoneButton done={done} busy={busy} onClick={toggle} title={task.title} />
    </div>
  );
}
