import type { CalendarProvider, NormalizedEvent, SyncResult } from './types';

const API = 'https://www.googleapis.com/calendar/v3';

/** Window we care about on a full resync. Nobody needs last year on a dashboard. */
const WINDOW_BACK_DAYS = 7;
const WINDOW_FWD_DAYS = 30;

async function gcal(path: string, token: string, params: Record<string, string>) {
  const res = await fetch(`${API}${path}?${new URLSearchParams(params)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err: Error & { status?: number } = new Error(`Calendar API ${res.status}: ${await res.text()}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function parseWhen(x: { date?: string; dateTime?: string }): { at: Date; allDay: boolean } {
  if (x.dateTime) return { at: new Date(x.dateTime), allDay: false };
  return { at: new Date(`${x.date}T00:00:00`), allDay: true };
}

export const googleCalendar: CalendarProvider = {
  id: 'google_calendar',

  async fetchEvents(accessToken, cursor): Promise<SyncResult<NormalizedEvent>> {
    const items: NormalizedEvent[] = [];
    let pageToken: string | undefined;
    let nextSyncToken: string | null = null;
    let resynced = false;

    const baseParams = (): Record<string, string> => {
      // A stored syncToken and a time window are mutually exclusive in this API.
      if (cursor && !resynced) return { syncToken: cursor, singleEvents: 'true', maxResults: '250' };
      const now = Date.now();
      return {
        timeMin: new Date(now - WINDOW_BACK_DAYS * 864e5).toISOString(),
        timeMax: new Date(now + WINDOW_FWD_DAYS * 864e5).toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '250',
      };
    };

    /* eslint-disable no-constant-condition */
    while (true) {
      const params = baseParams();
      if (pageToken) params.pageToken = pageToken;

      let data: any;
      try {
        data = await gcal('/calendars/primary/events', accessToken, params);
      } catch (e: any) {
        // 410 Gone: Google expired our syncToken. Documented and expected —
        // drop the cursor and refetch the window rather than failing the sync.
        if (e.status === 410 && !resynced) {
          resynced = true;
          pageToken = undefined;
          items.length = 0;
          continue;
        }
        throw e;
      }

      for (const ev of data.items ?? []) {
        // Cancelled events arrive as tombstones with almost no fields.
        if (ev.status === 'cancelled') {
          items.push({
            externalId: ev.id, calendarId: 'primary', title: null,
            startsAt: new Date(0), endsAt: new Date(0), allDay: false,
            attendeeCount: 0, deleted: true, status: 'cancelled',
          });
          continue;
        }
        const start = parseWhen(ev.start ?? {});
        const end = parseWhen(ev.end ?? ev.start ?? {});
        items.push({
          externalId: ev.id,
          calendarId: 'primary',
          title: ev.summary ?? null,
          description: ev.description ?? null,
          location: ev.location ?? null,
          startsAt: start.at,
          endsAt: end.at,
          allDay: start.allDay,
          status: ev.status ?? null,
          responseStatus: (ev.attendees ?? []).find((a: any) => a.self)?.responseStatus ?? null,
          attendeeCount: (ev.attendees ?? []).length,
          conferenceUrl: ev.hangoutLink ?? ev.conferenceData?.entryPoints?.[0]?.uri ?? null,
          htmlLink: ev.htmlLink ?? null,
          deleted: false,
        });
      }

      pageToken = data.nextPageToken;
      if (!pageToken) {
        nextSyncToken = data.nextSyncToken ?? null;
        break;
      }
    }

    return { items, cursor: nextSyncToken, resynced };
  },
};
