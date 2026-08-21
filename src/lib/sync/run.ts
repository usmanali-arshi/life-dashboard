import { decrypt } from '../crypto';
import { ENABLE_GMAIL } from '../env';
import { accessTokenFrom, ReauthRequiredError } from '../google/oauth';
import { googleCalendar } from '../providers/calendar-google';
import { googleMail } from '../providers/mail-google';
import { googleTasks } from '../providers/tasks-google';
import type { LinkedAccount } from '../providers/types';
import { supabaseAdmin } from '../supabase/admin';

/**
 * The sync engine. Runs from GitHub Actions every 15 minutes because Vercel's
 * Hobby cron is capped at once per day.
 *
 * Two invariants:
 *  1. Idempotent — everything upserts on (linked_account_id, external_id).
 *  2. Isolated — one account failing never blocks another. Promise.allSettled,
 *     never Promise.all.
 */

const STALE_MINUTES = 10;

export interface SyncReport {
  accountsAttempted: number;
  accountsSucceeded: number;
  events: number;
  threads: number;
  tasks: number;
  errors: { account: string; error: string }[];
}

async function getCursor(db: ReturnType<typeof supabaseAdmin>, accountId: string, resource: string) {
  const { data } = await db.from('sync_state').select('cursor')
    .eq('linked_account_id', accountId).eq('resource', resource).maybeSingle();
  return data?.cursor ?? null;
}

async function setCursor(db: ReturnType<typeof supabaseAdmin>, accountId: string, resource: string, cursor: string | null) {
  await db.from('sync_state').upsert(
    { linked_account_id: accountId, resource, cursor, last_run_at: new Date().toISOString() },
    { onConflict: 'linked_account_id,resource' },
  );
}

async function syncAccount(
  db: ReturnType<typeof supabaseAdmin>,
  account: LinkedAccount,
  report: SyncReport,
) {
  const accessToken = await accessTokenFrom(decrypt(account.refresh_token_enc));

  // Calendar ------------------------------------------------------------
  const calCursor = await getCursor(db, account.id, 'calendar');
  const cal = await googleCalendar.fetchEvents(accessToken, calCursor);
  if (cal.items.length) {
    const rows = cal.items.map((e) => ({
      user_id: account.user_id,
      linked_account_id: account.id,
      external_id: e.externalId,
      calendar_id: e.calendarId,
      title: e.title,
      description: e.description ?? null,
      location: e.location ?? null,
      starts_at: e.startsAt.toISOString(),
      ends_at: e.endsAt.toISOString(),
      all_day: e.allDay,
      status: e.status ?? null,
      response_status: e.responseStatus ?? null,
      attendee_count: e.attendeeCount,
      conference_url: e.conferenceUrl ?? null,
      html_link: e.htmlLink ?? null,
      deleted: e.deleted,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await db.from('calendar_events').upsert(rows, { onConflict: 'linked_account_id,external_id' });
    if (error) throw new Error(`calendar upsert: ${error.message}`);
    report.events += rows.length;
  }
  await setCursor(db, account.id, 'calendar', cal.cursor);

  // Tasks ---------------------------------------------------------------
  const tasks = await googleTasks.listTasks(accessToken);
  if (tasks.items.length) {
    const rows = tasks.items.map((t) => ({
      user_id: account.user_id,
      linked_account_id: account.id,
      provider: 'google_tasks',
      source: 'provider',
      external_id: t.externalId,
      external_list_id: t.listId ?? null,
      title: t.title,
      notes: t.notes ?? null,
      due: t.due ? t.due.toISOString() : null,
      due_is_date_only: t.dueIsDateOnly,
      completed: t.completed,
      completed_at: t.completedAt ? t.completedAt.toISOString() : null,
      priority: t.priority ?? null,
      project_name: t.projectName ?? null,
      url: t.url ?? null,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await db.from('tasks').upsert(rows, { onConflict: 'linked_account_id,provider,external_id' });
    if (error) throw new Error(`tasks upsert: ${error.message}`);
    report.tasks += rows.length;
  }

  // Gmail — restricted scope, gated ------------------------------------
  if (ENABLE_GMAIL) {
    const mail = await googleMail.fetchThreads(accessToken, null, account.email);
    if (mail.items.length) {
      const rows = mail.items.map((t) => ({
        user_id: account.user_id,
        linked_account_id: account.id,
        external_id: t.externalId,
        subject: t.subject,
        from_name: t.fromName,
        from_email: t.fromEmail,
        snippet: t.snippet,
        is_unread: t.isUnread,
        is_important: t.isImportant,
        is_starred: t.isStarred,
        needs_reply: t.needsReply,
        last_message_at: t.lastMessageAt.toISOString(),
        last_from_me: t.lastFromMe,
        message_count: t.messageCount,
        web_url: t.webUrl,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await db.from('email_threads').upsert(rows, { onConflict: 'linked_account_id,external_id' });
      if (error) throw new Error(`email upsert: ${error.message}`);
      report.threads += rows.length;
    }
  }

  await db.from('linked_accounts').update({
    last_synced_at: new Date().toISOString(),
    last_sync_error: null,
    status: 'active',
  }).eq('id', account.id);
}

export async function runSync(opts: { userId?: string; force?: boolean } = {}): Promise<SyncReport> {
  const db = supabaseAdmin();
  const report: SyncReport = {
    accountsAttempted: 0, accountsSucceeded: 0,
    events: 0, threads: 0, tasks: 0, errors: [],
  };

  let q = db.from('linked_accounts').select('*').eq('status', 'active').eq('provider', 'google');
  if (opts.userId) q = q.eq('user_id', opts.userId);
  if (!opts.force) {
    const stale = new Date(Date.now() - STALE_MINUTES * 60_000).toISOString();
    q = q.or(`last_synced_at.is.null,last_synced_at.lt.${stale}`);
  }

  const { data: accounts, error } = await q;
  if (error) throw new Error(`Failed to load accounts: ${error.message}`);

  report.accountsAttempted = accounts?.length ?? 0;

  const results = await Promise.allSettled(
    (accounts ?? []).map((a) => syncAccount(db, a as LinkedAccount, report)),
  );

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'fulfilled') {
      report.accountsSucceeded++;
      continue;
    }
    const account = accounts![i] as LinkedAccount;
    const message = r.reason instanceof Error ? r.reason.message : String(r.reason);
    report.errors.push({ account: account.email, error: message });

    // A revoked or expired refresh token is not retryable — flag it so the UI
    // can show a "reconnect Cornell" banner instead of failing silently forever.
    if (r.reason instanceof ReauthRequiredError) {
      await db.from('linked_accounts')
        .update({ status: 'reauth_required', last_sync_error: message })
        .eq('id', account.id);
    } else {
      await db.from('linked_accounts').update({ last_sync_error: message }).eq('id', account.id);
    }
  }

  return report;
}
