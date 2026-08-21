import { NextResponse } from 'next/server';
import { requireUser, supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Fixed categorical order — a color follows the account, so these are the only
// values the UI offers. Matches the palette in the OAuth callback.
const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];

/** Rename or recolor a linked account. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};

  if (typeof body.label === 'string') patch.label = body.label.trim().slice(0, 40) || null;
  // Visibility is a view preference, but it lives on the row so the filter is
  // identical across tabs and devices and can be applied in SQL.
  if (typeof body.visible === 'boolean') patch.visible = body.visible;
  if (typeof body.color === 'string') {
    // Allowlist rather than accepting arbitrary hex — keeps every account on a
    // slot that's been validated for contrast and colorblind separation.
    if (!PALETTE.includes(body.color)) {
      return NextResponse.json({ error: 'unknown color' }, { status: 400 });
    }
    patch.color = body.color;
  }
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  }

  // RLS scopes this to the caller's own rows; the explicit user_id filter is
  // belt-and-braces so a policy regression can't turn this into an IDOR.
  const sb = await supabaseServer();
  const { error } = await sb.from('linked_accounts')
    .update(patch).eq('id', id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

/** Disconnect an account. Cascades to its events, threads and tasks. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const sb = await supabaseServer();
  const { error } = await sb.from('linked_accounts')
    .delete().eq('id', id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
