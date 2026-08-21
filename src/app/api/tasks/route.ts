import { NextResponse } from 'next/server';
import { accountWithToken } from '@/lib/google/account';
import { googleTasks } from '@/lib/providers/tasks-google';
import { floatingDateToInstant } from '@/lib/dates';
import { requireUser, supabaseServer } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Task lists available on each connected account — populates the create form. */
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const sb = await supabaseServer();
  const { data: accounts } = await sb.from('linked_accounts')
    .select('id,label,email,color').eq('status', 'active').eq('visible', true).order('created_at');

  // One failing account must not blank out the picker for the others.
  const results = await Promise.allSettled((accounts ?? []).map(async (a) => {
    const { accessToken } = await accountWithToken(a.id);
    return { account: a, lists: await googleTasks.listTaskLists(accessToken) };
  }));

  return NextResponse.json({
    accounts: results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map((r) => r.value),
  });
}

/**
 * Create a task.
 *
 * Writes to Google first, then mirrors the row locally. That order matters: if
 * Google rejects it we surface the error and store nothing, rather than showing
 * a task that exists only here and silently disappears on the next sync.
 */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? '').trim();
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });

  const notes = body.notes ? String(body.notes).slice(0, 4000) : null;
  // Noon UTC keeps the UTC date component stable across every timezone.
  const due = body.due ? floatingDateToInstant(String(body.due)) : null;
  if (due && Number.isNaN(+due)) {
    return NextResponse.json({ error: 'invalid due date' }, { status: 400 });
  }

  const sb = await supabaseServer();
  const accountId: string | null = body.account_id ?? null;

  // No account chosen → a local-only task. Useful before any account is linked,
  // and for things that don't belong in a work task list.
  if (!accountId) {
    const { data, error } = await sb.from('tasks').insert({
      user_id: user.id,
      provider: 'native',
      source: 'local',
      title, notes,
      due: due ? due.toISOString() : null,
      due_is_date_only: true,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, task: data });
  }

  try {
    const { account, accessToken } = await accountWithToken(accountId);
    const created = await googleTasks.createTask(accessToken, body.list_id ?? null, {
      title, notes, due,
    });

    const { data, error } = await sb.from('tasks').upsert({
      user_id: user.id,
      linked_account_id: account.id,
      provider: 'google_tasks',
      source: 'provider',
      external_id: created.externalId,
      external_list_id: created.listId ?? null,
      title: created.title,
      notes: created.notes ?? null,
      due: created.due ? created.due.toISOString() : null,
      due_is_date_only: true,
      completed: false,
      project_name: created.projectName ?? null,
      url: created.url ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'linked_account_id,provider,external_id' }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, task: data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) }, { status: 500 },
    );
  }
}
