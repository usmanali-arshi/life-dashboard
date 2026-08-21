import type { MailProvider, NormalizedThread, SyncResult } from './types';

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';

/**
 * Gmail adapter — the only restricted-scope code in the app.
 *
 * PRIVACY CONTRACT, enforced here and depended on by architecture.md section 7:
 *   - format=metadata on every message fetch. We physically cannot receive a
 *     body; Google refuses to send one for that format.
 *   - The only free text we persist is `snippet`, which is Gmail's own ~200
 *     char preview.
 *   - No attachments, ever.
 * Keeping this contract narrow is what makes a future CASA assessment
 * tractable, and what limits the blast radius if the database leaks.
 */

const LOOKBACK_DAYS = 7;
const MAX_THREADS = 60;

async function gmail(path: string, token: string, params: Record<string, string | string[]> = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    Array.isArray(v) ? v.forEach((x) => qs.append(k, x)) : qs.append(k, v);
  }
  const res = await fetch(`${API}${path}?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const err: Error & { status?: number } = new Error(`Gmail API ${res.status}: ${await res.text()}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function header(headers: any[], name: string): string | null {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? null;
}

function parseFrom(raw: string | null): { name: string | null; email: string | null } {
  if (!raw) return { name: null, email: null };
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || null, email: m[2].toLowerCase() };
  return { name: null, email: raw.trim().toLowerCase() };
}

export const googleMail: MailProvider = {
  id: 'google_gmail',

  async fetchThreads(accessToken, _cursor, selfEmail): Promise<SyncResult<NormalizedThread>> {
    // Volume control: only threads that plausibly need attention. Syncing an
    // entire inbox would be slow, expensive, and useless for triage.
    const after = Math.floor((Date.now() - LOOKBACK_DAYS * 864e5) / 1000);
    const query = `(is:unread OR is:important OR is:starred) after:${after}`;

    const list = await gmail('/threads', accessToken, { q: query, maxResults: String(MAX_THREADS) });
    const items: NormalizedThread[] = [];

    for (const stub of list.threads ?? []) {
      const thread = await gmail(`/threads/${stub.id}`, accessToken, {
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      });

      const messages = thread.messages ?? [];
      if (!messages.length) continue;
      const last = messages[messages.length - 1];
      const headers = last.payload?.headers ?? [];
      const from = parseFrom(header(headers, 'From'));
      const labels: string[] = last.labelIds ?? [];
      const lastFromMe = from.email === selfEmail.toLowerCase();

      items.push({
        externalId: thread.id,
        subject: header(headers, 'Subject'),
        fromName: from.name,
        fromEmail: from.email,
        snippet: last.snippet ?? null,
        isUnread: labels.includes('UNREAD'),
        isImportant: labels.includes('IMPORTANT'),
        isStarred: labels.includes('STARRED'),
        // Heuristic, and honest about it: the last message in a thread that
        // someone else sent, addressed to you, is probably your turn. Refine
        // later with question-mark detection or an LLM pass if it's noisy.
        needsReply: !lastFromMe && (labels.includes('UNREAD') || labels.includes('IMPORTANT')),
        lastMessageAt: new Date(Number(last.internalDate)),
        lastFromMe,
        messageCount: messages.length,
        webUrl: `https://mail.google.com/mail/u/${encodeURIComponent(selfEmail)}/#inbox/${thread.id}`,
      });
    }

    // No cursor: the rolling 7-day query is its own incrementality, and it
    // sidesteps historyId expiry entirely.
    return { items, cursor: null };
  },
};
