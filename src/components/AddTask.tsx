'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

interface ListOption { id: string; title: string; }
interface AccountOption {
  account: { id: string; label: string | null; email: string; color: string };
  lists: ListOption[];
}

const NEW_LIST = '__new__';

/**
 * Google-Tasks-shaped add form: title first and always focused, everything else
 * as secondary controls underneath. You can type a title and hit Enter without
 * touching the rest.
 */
export function AddTask() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<AccountOption[] | null>(null);
  const [accountId, setAccountId] = useState('');
  const [listId, setListId] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [creatingList, setCreatingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const newListRef = useRef<HTMLInputElement>(null);

  /** Confirmation of the last successful add, shown after the form closes. */
  const [flash, setFlash] = useState<{ title: string; where: string } | null>(null);

  // Fetched only when the form opens — it costs one Google call per connected
  // account, and most page views never open it.
  useEffect(() => {
    if (!open || options) return;
    fetch('/api/tasks')
      .then((r) => r.json())
      .then((d) => {
        const accs: AccountOption[] = d.accounts ?? [];
        setOptions(accs);
        if (accs[0]) {
          setAccountId(accs[0].account.id);
          setListId(accs[0].lists[0]?.id ?? '');
        }
      })
      .catch(() => setOptions([]));
  }, [open, options]);

  useEffect(() => { if (creatingList) newListRef.current?.focus(); }, [creatingList]);

  const currentAccount = options?.find((o) => o.account.id === accountId);
  const lists = currentAccount?.lists ?? [];
  const accountColor = currentAccount?.account.color;

  /** Returns the id of the list to file the task under, creating it if needed. */
  async function resolveListId(): Promise<string | null> {
    if (!creatingList) return listId && listId !== NEW_LIST ? listId : null;

    const name = newListName.trim();
    if (!name || !accountId) return null;

    const res = await fetch('/api/tasks/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: name, account_id: accountId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? 'Could not create that list');

    // Splice it into the cached options so the picker updates without a refetch,
    // and leave it selected — the next task you add lands in it too.
    setOptions((prev) => (prev ?? []).map((o) =>
      o.account.id === accountId ? { ...o, lists: [...o.lists, data.list] } : o));
    setListId(data.list.id);
    setCreatingList(false);
    setNewListName('');
    return data.list.id as string;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      // One button, two steps behind it: create the list if the user named a new
      // one, then file the task into it.
      const targetList = await resolveListId();

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          notes: notes || null,
          due: due || null,
          account_id: accountId || null,
          list_id: targetList,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not create task');

      // Name the destination from the server's echo of the created task, not
      // from local form state. If Google filed it somewhere else — the default
      // list when none was picked, say — the message has to say where it
      // actually went, or the confirmation is a lie that looks like a success.
      const accountName = accountId
        ? (currentAccount?.account.label ?? currentAccount?.account.email ?? 'your account')
        : 'this dashboard';
      const listName = data.task?.project_name
        ?? (creatingList ? newListName.trim() : lists.find((l) => l.id === targetList)?.title);

      setFlash({
        title: data.task?.title ?? title,
        where: accountId && listName ? `${accountName} · ${listName}` : accountName,
      });

      // Close, because a form that clears itself and stays open looks identical
      // whether the task saved or silently failed. Closing plus a named
      // confirmation is unambiguous.
      setTitle(''); setNotes(''); setDue('');
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <span className="addtask-closed">
        {flash && (
          <span className="addflash" role="status">
            <span className="addflash-tick" aria-hidden>✓</span>
            Added <strong>{flash.title}</strong> to {flash.where}
            <button className="iconbtn" type="button" aria-label="Dismiss"
                    onClick={() => setFlash(null)}>✕</button>
          </span>
        )}
        <button className="btn" onClick={() => { setFlash(null); setOpen(true); }}>
          + Add task
        </button>
      </span>
    );
  }

  return (
    <form onSubmit={submit} className="card addtask">
      <input
        className="addtask-title" value={title} autoFocus required
        placeholder="Add a task"
        onChange={(e) => setTitle(e.target.value)}
      />

      <input
        className="addtask-notes" value={notes} placeholder="Details (optional)"
        onChange={(e) => setNotes(e.target.value)}
      />

      <div className="addtask-controls">
        {/* Fixed width so switching Personal → NYU doesn't resize the control
            and shove everything after it sideways. The border and inset rail
            carry the selected account's identity colour. */}
        <select
          className="input fixed acct-select" value={accountId}
          style={accountColor ? {
            borderColor: accountColor,
            boxShadow: `inset 4px 0 0 ${accountColor}`,
          } : undefined}
          onChange={(e) => {
            setAccountId(e.target.value);
            const acc = options?.find((o) => o.account.id === e.target.value);
            setListId(acc?.lists[0]?.id ?? '');
            setCreatingList(false);
          }}>
          {/* Local tasks belong to no provider — they never sync anywhere and
              they survive the account filter. */}
          <option value="">Just this dashboard</option>
          {(options ?? []).map((o) => (
            <option key={o.account.id} value={o.account.id}>
              {o.account.label ?? o.account.email}
            </option>
          ))}
        </select>

        {accountId && !creatingList && (
          <select className="input fixed" value={listId}
                  onChange={(e) => {
                    if (e.target.value === NEW_LIST) { setCreatingList(true); return; }
                    setListId(e.target.value);
                  }}>
            {lists.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
            <option value={NEW_LIST}>+ New list…</option>
          </select>
        )}

        {accountId && creatingList && (
          <span className="newlist">
            <input
              ref={newListRef} className="input fixed" value={newListName}
              placeholder="New list name" maxLength={100}
              onKeyDown={(e) => {
                // Escape backs out to the existing-list picker.
                if (e.key === 'Escape') { setCreatingList(false); setNewListName(''); }
              }}
              onChange={(e) => setNewListName(e.target.value)}
            />
            <button
              className="iconbtn" type="button" title="Pick an existing list instead"
              aria-label="Pick an existing list instead"
              onClick={() => { setCreatingList(false); setNewListName(''); }}
            >
              ✕
            </button>
          </span>
        )}

        {/* An empty date input reads as "dd/mm/yyyy" with no indication of what
            the date is for. A real <label> also gives the field a click target
            and an accessible name. */}
        <label className="field">
          <span className="field-label">Due date</span>
          <input className="input fixed" type="date" value={due}
                 onChange={(e) => setDue(e.target.value)} />
        </label>

        <span style={{ flex: 1 }} />
        <button
          className="btn" type="submit"
          disabled={busy || !title.trim() || (creatingList && !newListName.trim())}
        >
          {/* Label stays constant whether or not a new list is being created —
              the button does one thing from the user's point of view: add the
              task. Creating the list is an implementation step, not a mode. */}
          {busy ? 'Adding…' : 'Add task'}
        </button>
        <button className="btn secondary" type="button" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>

      {options?.length === 0 && (
        <p className="addtask-hint">
          No connected account can accept tasks right now — this will be saved locally.
        </p>
      )}
      {accountId && (
        <p className="addtask-hint">
          Lists you create here are real Google Tasks lists — they appear in Gmail and
          the Tasks app too.
        </p>
      )}
      {error && <p style={{ color: 'var(--critical)', fontSize: 13, margin: 0 }}>{error}</p>}
    </form>
  );
}
