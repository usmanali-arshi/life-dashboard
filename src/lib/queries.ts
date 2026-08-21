import { dueDayKey, todayKeyIn, tomorrowKeyIn } from './dates';
import { supabaseServer } from './supabase/server';

/**
 * Read layer. Every page reads from Postgres only — never calls Google inline.
 * That's the cache-then-render decision from architecture.md §3: pages stay fast
 * and keep working when Google is slow, rate-limits us, or is down.
 *
 * These go through the RLS-scoped client, so a missing user_id filter returns
 * nothing rather than leaking someone else's inbox.
 *
 * ACCOUNT VISIBILITY: every content query filters to accounts where
 * visible = true. Applied in SQL rather than by hiding rows in the UI, so a
 * hidden account genuinely doesn't reach the browser, and counts/briefings are
 * computed on what you can actually see.
 */

export interface DayBounds { start: string; end: string; }

export function dayBounds(tz: string, now = new Date()): DayBounds {
  // Midnight-to-midnight in the user's zone, expressed as UTC instants.
  const local = new Date(now.toLocaleString('en-US', { timeZone: tz }));
  const offsetMs = now.getTime() - local.getTime();
  const startLocal = new Date(local);
  startLocal.setHours(0, 0, 0, 0);
  const start = new Date(+startLocal + offsetMs);
  return { start: start.toISOString(), end: new Date(+start + 864e5).toISOString() };
}

export async function getProfile() {
  const sb = await supabaseServer();
  const { data } = await sb.from('profiles').select('*').maybeSingle();
  return data;
}

/** Every linked account, including hidden ones — the filter UI needs them all. */
export async function getAccounts() {
  const sb = await supabaseServer();
  const { data } = await sb.from('linked_accounts')
    .select('id,email,label,color,status,visible,last_synced_at,last_sync_error')
    .order('created_at');
  return data ?? [];
}

export async function getVisibleAccountIds(): Promise<string[]> {
  const sb = await supabaseServer();
  const { data } = await sb.from('linked_accounts').select('id').eq('visible', true);
  return (data ?? []).map((a) => a.id);
}

export async function getTodayEvents(tz: string, visibleIds?: string[]) {
  const ids = visibleIds ?? await getVisibleAccountIds();
  if (!ids.length) return [];
  const sb = await supabaseServer();
  const { start, end } = dayBounds(tz);
  const { data } = await sb.from('calendar_events')
    .select('*,linked_accounts(label,email,color)')
    .in('linked_account_id', ids)
    .eq('deleted', false)
    .neq('status', 'cancelled')
    .gte('starts_at', start)
    .lt('starts_at', end)
    .order('starts_at');
  return data ?? [];
}

export async function getUpcomingEvents(days = 7, visibleIds?: string[]) {
  const ids = visibleIds ?? await getVisibleAccountIds();
  if (!ids.length) return [];
  const sb = await supabaseServer();
  const { data } = await sb.from('calendar_events')
    .select('*,linked_accounts(label,email,color)')
    .in('linked_account_id', ids)
    .eq('deleted', false)
    .neq('status', 'cancelled')
    .gte('starts_at', new Date().toISOString())
    .lt('starts_at', new Date(Date.now() + days * 864e5).toISOString())
    .order('starts_at');
  return data ?? [];
}

/** Events overlapping [startISO, endISO) — used by the week calendar. */
export async function getEventsRange(startISO: string, endISO: string, visibleIds?: string[]) {
  const ids = visibleIds ?? await getVisibleAccountIds();
  if (!ids.length) return [];
  const sb = await supabaseServer();
  const { data } = await sb.from('calendar_events')
    .select('*,linked_accounts(label,email,color)')
    .in('linked_account_id', ids)
    .eq('deleted', false)
    .neq('status', 'cancelled')
    .lt('starts_at', endISO)
    .gte('ends_at', startISO)
    .order('starts_at');
  return data ?? [];
}

export async function getTriage(visibleIds?: string[]) {
  const ids = visibleIds ?? await getVisibleAccountIds();
  if (!ids.length) return { all: [], needsReply: [], unread: [] };
  const sb = await supabaseServer();
  const { data } = await sb.from('email_threads')
    .select('*,linked_accounts(label,email,color)')
    .in('linked_account_id', ids)
    .eq('deleted', false)
    .order('last_message_at', { ascending: false })
    .limit(100);
  const all = data ?? [];
  return {
    all,
    needsReply: all.filter((t) => t.needs_reply),
    unread: all.filter((t) => t.is_unread),
  };
}

export async function getTasks(tz: string, visibleIds?: string[]) {
  const ids = visibleIds ?? await getVisibleAccountIds();
  const sb = await supabaseServer();
  const { end } = dayBounds(tz);

  let q = sb.from('tasks')
    .select('*,linked_accounts(label,email,color)')
    .eq('deleted', false)
    .eq('completed', false)
    .order('due', { nullsFirst: false });

  // Locally-created tasks have no linked_account_id and belong to no provider,
  // so they must survive the account filter — they aren't "from" any account.
  q = ids.length
    ? q.or(`linked_account_id.is.null,linked_account_id.in.(${ids.join(',')})`)
    : q.is('linked_account_id', null);

  const { data } = await q;
  const all = data ?? [];

  // Due dates are floating dates read in UTC; "today" is a real instant read in
  // the user's zone. See lib/dates.ts — mixing the two shifted every due date a
  // day earlier for anyone west of UTC.
  const day = dueDayKey;
  const today = todayKeyIn(tz);
  const tomorrow = tomorrowKeyIn(tz);

  // "Later" is dated-but-not-soon; "unscheduled" is genuinely undated. Lumping
  // them together hid a real distinction — a task due next Friday is planned,
  // a task with no date is a decision you haven't made yet.
  return {
    all,
    overdue: all.filter((t) => t.due && day(t.due) < today),
    dueToday: all.filter((t) => t.due && day(t.due) === today),
    tomorrow: all.filter((t) => t.due && day(t.due) === tomorrow),
    later: all.filter((t) => t.due && day(t.due) > tomorrow),
    unscheduled: all.filter((t) => !t.due),
  };
}

/** Completed today — so ticking something off doesn't make it vanish entirely. */
export async function getCompletedToday(tz: string) {
  const sb = await supabaseServer();
  const { start } = dayBounds(tz);
  const { data } = await sb.from('tasks')
    .select('*,linked_accounts(label,email,color)')
    .eq('deleted', false)
    .eq('completed', true)
    .gte('completed_at', start)
    .order('completed_at', { ascending: false });
  return data ?? [];
}

export async function getHabitsToday() {
  const sb = await supabaseServer();
  const today = new Date().toISOString().slice(0, 10);
  const { data: habits } = await sb.from('habits')
    .select('*').eq('archived', false).order('sort_order');
  const { data: entries } = await sb.from('habit_entries')
    .select('habit_id,value').eq('on_date', today);
  const done = new Set((entries ?? []).map((e) => e.habit_id));
  return (habits ?? []).map((h) => ({ ...h, doneToday: done.has(h.id) }));
}

export async function getTodayBriefing() {
  const sb = await supabaseServer();
  const { data } = await sb.from('briefings')
    .select('*').eq('on_date', new Date().toISOString().slice(0, 10)).maybeSingle();
  return data;
}
