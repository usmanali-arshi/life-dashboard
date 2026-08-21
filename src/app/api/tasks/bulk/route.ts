import { NextResponse } from 'next/server';
import { accountWithToken } from '@/lib/google/account';
import { googleTasks } from '@/lib/providers/tasks-google';
import { requireUser, supabaseServer } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const MAX_IDS = 200;

/**
 * Complete (or un-complete) many tasks at once.
 *
 * One endpoint rather than N requests from the browser, so a partial failure is
 * reported as a partial failure — "18 of 20 done, 2 failed" — instead of the UI
 * guessing from a pile of independent promises.
 *
 * Access tokens are derived once per account, not once per task; a 40-task
 * bulk complete across two accounts costs two token exchanges.
 */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids) ? body.ids.slice(0, MAX_IDS) : [];
  const completed = body.completed !== false;
  if (!ids.length) return NextResponse.json({ error: 'no ids' }, { status: 400 });

  const sb = await supabaseServer();
  // RLS means this only ever returns the caller's own rows, so ids belonging to
  // someone else silently resolve to nothing rather than being actioned.
  const { data: tasks, error } = await sb.from('tasks').select('*').in('id', ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!tasks?.length) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const byAccount = new Map<string, typeof tasks>();
  const localOnly: typeof tasks = [];
  for (const t of tasks) {
    if (t.provider === 'google_tasks' && t.linked_account_id && t.external_id && t.external_list_id) {
      const list = byAccount.get(t.linked_account_id) ?? [];
      list.push(t);
      byAccount.set(t.linked_account_id, list);
    } else {
      localOnly.push(t);
    }
  }

  const succeeded: string[] = localOnly.map((t) => t.id);
  const failed: { id: string; title: string; error: string }[] = [];

  await Promise.all([...byAccount.entries()].map(async ([accountId, group]) => {
    let accessToken: string;
    try {
      ({ accessToken } = await accountWithToken(accountId));
    } catch (e) {
      // Whole account unreachable — fail its tasks together rather than
      // retrying a dead token once per item.
      const message = e instanceof Error ? e.message : String(e);
      group.forEach((t) => failed.push({ id: t.id, title: t.title, error: message }));
      return;
    }
    const results = await Promise.allSettled(group.map((t) =>
      googleTasks.setCompleted(accessToken, {
        listId: t.external_list_id!, taskId: t.external_id!,
      }, completed)));

    results.forEach((r, i) => {
      if (r.status === 'fulfilled') succeeded.push(group[i].id);
      else failed.push({
        id: group[i].id,
        title: group[i].title,
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    });
  }));

  // Only mirror the ones Google actually accepted, so the dashboard never shows
  // a task as done that is still open in Google Tasks.
  if (succeeded.length) {
    const { error: updateError } = await sb.from('tasks').update({
      completed,
      completed_at: completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).in('id', succeeded);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: failed.length === 0,
    completed: succeeded.length,
    failed,
  });
}
