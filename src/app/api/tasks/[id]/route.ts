import { NextResponse } from 'next/server';
import { accountWithToken } from '@/lib/google/account';
import { googleTasks } from '@/lib/providers/tasks-google';
import { floatingDateToInstant } from '@/lib/dates';
import { requireUser, supabaseServer } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Edit or complete a task.
 *
 * Provider-backed tasks are written to Google first and mirrored locally only on
 * success — the reverse order would let the UI drift from the source of truth
 * until the next sync overwrote it, which reads as "my edit didn't save".
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const sb = await supabaseServer();
  // RLS scopes this to the caller's rows; if it isn't theirs, it isn't found.
  const { data: task, error: findError } = await sb.from('tasks')
    .select('*').eq('id', id).maybeSingle();
  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 });
  if (!task) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const local: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const patch: { title?: string; notes?: string | null; due?: Date | null } = {};

  if (typeof body.title === 'string' && body.title.trim()) {
    patch.title = body.title.trim().slice(0, 500);
    local.title = patch.title;
  }
  if (body.notes !== undefined) {
    patch.notes = body.notes ? String(body.notes).slice(0, 4000) : null;
    local.notes = patch.notes;
  }
  if (body.due !== undefined) {
    const due = body.due ? floatingDateToInstant(String(body.due)) : null;
    if (due && Number.isNaN(+due)) {
      return NextResponse.json({ error: 'invalid due date' }, { status: 400 });
    }
    patch.due = due;
    local.due = due ? due.toISOString() : null;
  }

  const completing = typeof body.completed === 'boolean';
  if (completing) {
    local.completed = body.completed;
    local.completed_at = body.completed ? new Date().toISOString() : null;
  }

  try {
    if (task.provider === 'google_tasks' && task.linked_account_id && task.external_id) {
      if (!task.external_list_id) {
        // Pre-0003 rows predate the list id. One sync fills it in.
        return NextResponse.json(
          { error: 'This task predates task editing — hit Sync now, then retry.' },
          { status: 409 },
        );
      }
      const { accessToken } = await accountWithToken(task.linked_account_id);
      const ref = { listId: task.external_list_id, taskId: task.external_id };
      if (Object.keys(patch).length) await googleTasks.updateTask(accessToken, ref, patch);
      if (completing) await googleTasks.setCompleted(accessToken, ref, body.completed);
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) }, { status: 502 },
    );
  }

  const { data, error } = await sb.from('tasks')
    .update(local).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, task: data });
}

/** Delete a local task. Provider tasks are soft-deleted locally only —
 *  we don't hold a delete scope, and silently removing someone's Google task
 *  from a dashboard would be surprising. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const sb = await supabaseServer();
  const { data: task } = await sb.from('tasks').select('source').eq('id', id).maybeSingle();
  if (!task) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const { error } = task.source === 'local'
    ? await sb.from('tasks').delete().eq('id', id)
    : await sb.from('tasks').update({ deleted: true }).eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
