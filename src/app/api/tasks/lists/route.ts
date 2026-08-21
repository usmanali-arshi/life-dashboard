import { NextResponse } from 'next/server';
import { accountWithToken } from '@/lib/google/account';
import { googleTasks } from '@/lib/providers/tasks-google';
import { requireUser } from '@/lib/supabase/server';

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
