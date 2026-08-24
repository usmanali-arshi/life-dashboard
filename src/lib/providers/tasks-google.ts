import type {
  NormalizedTask, SyncResult, TaskList, TaskPatch, TaskProvider, TaskRef,
} from './types';

const API = 'https://tasks.googleapis.com/tasks/v1';

async function gtasks(
  path: string, token: string, init: RequestInit = {}, params: Record<string, string> = {},
) {
  const qs = Object.keys(params).length ? `?${new URLSearchParams(params)}` : '';
  const res = await fetch(`${API}${path}${qs}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Tasks API ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

/**
 * Google Tasks due dates are date-only. The API still wants RFC3339, but it
 * discards the time component — so send midnight UTC and never try to express
 * a time of day here, or it'll silently round and look like a bug.
 */
function toGoogleDue(due: Date): string {
  return `${due.toISOString().slice(0, 10)}T00:00:00.000Z`;
}

export const googleTasks: TaskProvider = {
  id: 'google_tasks',

  async listTaskLists(accessToken): Promise<TaskList[]> {
    const data = await gtasks('/users/@me/lists', accessToken, {}, { maxResults: '100' });
    return (data?.items ?? []).map((l: any) => ({ id: l.id, title: l.title }));
  },

  /**
   * Create a new task list. This is a real Google Tasks list — it shows up in
   * Gmail's side panel and the Tasks mobile app, not just here.
   */
  async createTaskList(accessToken, title): Promise<TaskList> {
    const created = await gtasks('/users/@me/lists', accessToken, {
      method: 'POST',
      body: JSON.stringify({ title: title.trim().slice(0, 100) }),
    });
    return { id: created.id, title: created.title };
  },

  /**
   * Rename a list.
   *
   * PATCH rather than PUT: PUT on this endpoint replaces the resource, and
   * Google treats omitted fields as cleared. PATCH touches only the title.
   */
  async renameTaskList(accessToken, listId, title): Promise<TaskList> {
    const updated = await gtasks(`/users/@me/lists/${listId}`, accessToken, {
      method: 'PATCH',
      body: JSON.stringify({ title: title.trim().slice(0, 100) }),
    });
    return { id: updated.id, title: updated.title };
  },

  /**
   * Full refetch every run. Google Tasks has no useful incremental sync and the
   * volume is tens of items — cursor bookkeeping would cost more than it saves.
   */
  async listTasks(accessToken): Promise<SyncResult<NormalizedTask>> {
    const lists = await this.listTaskLists(accessToken);
    const items: NormalizedTask[] = [];

    for (const list of lists) {
      const data = await gtasks(`/lists/${list.id}/tasks`, accessToken, {}, {
        maxResults: '100',
        showCompleted: 'true',
        showHidden: 'false',
      });
      for (const t of data?.items ?? []) {
        items.push({
          externalId: t.id,
          listId: list.id,
          title: t.title || '(untitled)',
          notes: t.notes ?? null,
          due: t.due ? new Date(t.due) : null,
          dueIsDateOnly: true,
          completed: t.status === 'completed',
          completedAt: t.completed ? new Date(t.completed) : null,
          priority: null,
          projectName: list.title ?? null,
          url: t.webViewLink ?? null,
        });
      }
    }
    return { items, cursor: null };
  },

  async setCompleted(accessToken, ref: TaskRef, completed) {
    await gtasks(`/lists/${ref.listId}/tasks/${ref.taskId}`, accessToken, {
      method: 'PATCH',
      body: JSON.stringify(
        completed
          ? { status: 'completed', completed: new Date().toISOString() }
          // Clearing `completed` alongside the status matters — leaving a
          // completion timestamp on a needsAction task confuses Google's UI.
          : { status: 'needsAction', completed: null },
      ),
    });
  },

  async updateTask(accessToken, ref: TaskRef, patch: TaskPatch) {
    const body: Record<string, unknown> = {};
    if (patch.title !== undefined) body.title = patch.title;
    if (patch.notes !== undefined) body.notes = patch.notes ?? '';
    if (patch.due !== undefined) body.due = patch.due ? toGoogleDue(patch.due) : null;
    if (!Object.keys(body).length) return;

    await gtasks(`/lists/${ref.listId}/tasks/${ref.taskId}`, accessToken, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  async createTask(accessToken, listId, task): Promise<NormalizedTask> {
    let target = listId;
    let listTitle: string | null = null;
    const lists = await this.listTaskLists(accessToken);
    if (!target) target = lists[0]?.id ?? null;
    listTitle = lists.find((l) => l.id === target)?.title ?? null;
    if (!target) throw new Error('No Google Tasks list available on this account');

    const created = await gtasks(`/lists/${target}/tasks`, accessToken, {
      method: 'POST',
      body: JSON.stringify({
        title: task.title,
        notes: task.notes ?? undefined,
        due: task.due ? toGoogleDue(task.due) : undefined,
      }),
    });

    return {
      externalId: created.id,
      listId: target,
      title: created.title,
      notes: created.notes ?? null,
      due: created.due ? new Date(created.due) : null,
      dueIsDateOnly: true,
      completed: false,
      projectName: listTitle,
      url: created.webViewLink ?? null,
    };
  },
};
