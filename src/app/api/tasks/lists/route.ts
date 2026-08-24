import { NextResponse } from 'next/server';
import { accountWithToken } from '@/lib/google/account';
import { googleTasks } from '@/lib/providers/tasks-google';
import { requireUser, supabaseServer } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Create a Google Tasks list on one of the caller's connected accounts.
 *
 * This creates a real list in Google, not a local label — it appears in Gmail's
 * task panel and the Tasks app too. That's the point: the dashboard shouldn't
 * invent an organising concept that only exists here and vanishes everywhere
 * else you look at your tasks.
 */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? '').trim();
  const accountId = String(body.account_id ?? '');

  if (!title) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  if (!accountId) return NextResponse.json({ error: 'pick an account first' }, { status: 400 });

  try {
    const { accessToken } = await accountWithToken(accountId);
    const list = await googleTasks.createTaskList(accessToken, title);
    return NextResponse.json({ ok: true, list });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) }, { status: 502 },
    );
  }
}

/**
 * Rename a list.
 *
 * Google is the source of truth, so it goes first — if the rename is rejected
 * we've changed nothing anywhere. Only once it succeeds do we update the local
 * mirror, because `project_name` is denormalised onto every task row and the
 * next sync is up to 15 minutes away. Skipping that second write would leave
 * the page showing the old name until the cron caught up, which reads as "the
 * rename didn't work".
 */
export async function PATCH(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? '').trim();
  const listId = String(body.list_id ?? '');
  const accountId = String(body.account_id ?? '');

  if (!title) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  if (!listId || !accountId) {
    return NextResponse.json({ error: 'list_id and account_id are required' }, { status: 400 });
  }

  try {
    const { accessToken } = await accountWithToken(accountId);
    const list = await googleTasks.renameTaskList(accessToken, listId, title);

    // RLS scopes this to the caller, and linked_account_id scopes it to the
    // account that actually owns the list — two accounts can hold lists with
    // the same provider-side id shape, and renaming one must not touch another.
    const sb = await supabaseServer();
    const { error } = await sb.from('tasks')
      .update({ project_name: list.title })
      .eq('linked_account_id', accountId)
      .eq('external_list_id', listId);

    // The rename itself succeeded; a failed mirror write is a staleness bug,
    // not a failure, so say so rather than reporting the whole thing broken.
    return NextResponse.json({
      ok: true,
      list,
      ...(error ? { warning: 'Renamed in Google, but the local copy will lag until the next sync.' } : {}),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) }, { status: 502 },
    );
  }
}
