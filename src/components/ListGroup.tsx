'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { TaskItem, type TaskRow } from './TaskItem';

export interface Group {
  key: string;
  accountId: string | null;
  listId: string | null;
  accountName: string;
  listName: string | null;
  color: string | null;
  tasks: TaskRow[];
}

/**
 * Split a block's tasks into account+list groups, preserving the order they
 * arrived in.
 *
 * Grouping on the provider's list id rather than the display name matters: two
 * accounts can each have a list called "Personal", and keying on the name would
 * silently merge them into one heading — then a rename would appear to affect
 * someone else's list.
 */
export function groupByList(tasks: TaskRow[]): Group[] {
  const groups = new Map<string, Group>();

  for (const t of tasks) {
    const accountId = t.linked_account_id ?? null;
    const listId = t.external_list_id ?? null;
    const key = `${accountId ?? 'local'}::${listId ?? t.project_name ?? '—'}`;

    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        accountId,
        listId,
        accountName: t.linked_accounts
          ? (t.linked_accounts.label ?? t.linked_accounts.email)
          : 'This dashboard',
        listName: t.project_name,
        color: t.linked_accounts?.color ?? null,
        tasks: [],
      };
      groups.set(key, g);
    }
    g.tasks.push(t);
  }

  return [...groups.values()];
}

/**
 * One account+list heading and its tasks.
 *
 * The heading is only rendered when a block holds more than one group — a
 * solitary "Cornell · Deep Learning" above an otherwise identical list is pure
 * chrome, and it pushes the actual tasks down the page for no information gain.
 */
export function ListGroupSection({
  group, tz, showHeading, selected, onSelect,
}: {
  group: Group;
  tz: string;
  showHeading: boolean;
  selected: Set<string>;
  onSelect: (id: string, next: boolean) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.listName ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // Local tasks have no provider-side list to rename.
  const renameable = Boolean(group.accountId && group.listId);

  async function save() {
    const next = name.trim();
    if (!next || next === group.listName) { setEditing(false); return; }

    setBusy(true); setError(null); setNote(null);
    const res = await fetch('/api/tasks/lists', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        list_id: group.listId, account_id: group.accountId, title: next,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      // Put the old name back. A field left showing text that was never saved
      // is the same failure mode as optimistic UI that reverts silently.
      setError(data.error ?? 'Could not rename that list');
      setName(group.listName ?? '');
      return;
    }
    if (data.warning) setNote(data.warning);
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="listgroup">
      {showHeading && (
        <div className="listgroup-head">
          <span className="dot sm" aria-hidden
                style={{ background: group.color ?? 'var(--text-muted)' }} />
          <span className="listgroup-acct">{group.accountName}</span>

          {editing ? (
            <>
              <input
                className="input listgroup-input" value={name} autoFocus disabled={busy}
                maxLength={100} aria-label="List name"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); save(); }
                  if (e.key === 'Escape') {
                    setName(group.listName ?? ''); setEditing(false); setError(null);
                  }
                }}
                onBlur={save}
              />
              {busy && <span className="listgroup-busy">Saving…</span>}
            </>
          ) : (
            <>
              <span className="listgroup-sep" aria-hidden>·</span>
              {renameable ? (
                <button
                  className="listgroup-name" type="button"
                  title="Rename this list in Google Tasks"
                  onClick={() => setEditing(true)}
                >
                  {group.listName ?? 'Untitled list'}
                </button>
              ) : (
                <span className="listgroup-name static">{group.listName ?? 'Local'}</span>
              )}
            </>
          )}

          <span className="listgroup-count">{group.tasks.length}</span>
        </div>
      )}

      {error && <p className="listgroup-error">{error}</p>}
      {note && <p className="listgroup-note">{note}</p>}

      <div className="rowlist">
        {group.tasks.map((t) => (
          <TaskItem
            key={t.id} task={t} tz={tz}
            selectable={!t.completed}
            selected={selected.has(t.id)}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
