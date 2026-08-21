# Life Dashboard

Calendar, email, tasks and habits from every Google account you own, on one page,
with a daily briefing.

Architecture and decisions: see `architecture.md` in the Claude project.
Google Cloud console walkthrough: `google-cloud-setup.md`.

## Layout

```
src/
  app/
    page.tsx                    Home — briefing, stat tiles, agenda, triage
    calendar/ inbox/ tasks/ habits/ settings/ login/
    api/auth/google/start/      begin account linking (once per account)
    api/auth/google/callback/   token exchange, encrypt + store refresh token
    api/cron/sync/              CRON_SECRET-protected, called by GitHub Actions
  lib/
    env.ts          fail-fast config + ENABLE_GMAIL flag
    crypto.ts       AES-256-GCM for refresh tokens at rest
    queries.ts      read layer — Postgres only, never Google inline
    google/oauth.ts authorize / exchange / refresh
    providers/      CalendarProvider · MailProvider · TaskProvider + Google impls
    briefing/       BriefingGenerator interface + template implementation
    sync/run.ts     the sync engine
  middleware.ts     refreshes the Supabase session cookie
supabase/migrations/0001_init.sql
.github/workflows/sync.yml      */15 cron
```

## Design notes worth knowing before you edit

**Cache-then-render.** Pages read only from Postgres. The sync job is the sole
thing that talks to Google. Page loads stay fast, survive Google outages, and we
get history for free (habit streaks, "how busy was last week") — which a
live-fetch design can't do.

**Login ≠ linked account.** Supabase Auth handles who you are, once. Google
account linking is a separate hand-rolled flow, run once per account, each
producing its own encrypted refresh token row. Supabase's built-in Google
provider manages one identity per user and would fight you by the third account.

**Everything Google is behind an interface.** `TaskProvider`, `CalendarProvider`,
`MailProvider`. Adding Todoist or Outlook is one new file plus a registry entry —
no schema migration, no UI change.

**`ENABLE_GMAIL` is a compliance switch, not a preference.** Set it to `false` and
the app never requests the restricted Gmail scope, never syncs mail, and hides the
Inbox tab. That's the deployment you ship publicly if the CASA assessment isn't
worth it. See architecture.md §7.

**Email is metadata + snippet only.** The Gmail adapter uses `format=metadata`, so
Google physically will not send us message bodies. Purged after 30 days.

## Local setup

```bash
npm install
cp .env.example .env.local     # fill it in — see google-cloud-setup.md
openssl rand -base64 32        # TOKEN_ENC_KEY
openssl rand -hex 32           # CRON_SECRET
npm run dev
```

Then: run `supabase/migrations/0001_init.sql` in the Supabase SQL editor, sign in
at `/login`, and connect accounts one at a time at `/settings`.

Trigger a sync by hand instead of waiting for the cron:

```bash
curl -X POST localhost:3000/api/cron/sync -H "Authorization: Bearer $CRON_SECRET"
```

## Deploy

```bash
gh repo create life-dashboard --private --source=. --push
```

1. **vercel.com → Add New → Project** → import the repo. Framework auto-detects.
2. Add every var from `.env.example` under **Settings → Environment Variables**.
   Set `APP_URL` to the real `https://<app>.vercel.app` — no trailing slash.
3. Deploy, then add `https://<app>.vercel.app/api/auth/google/callback` to the
   **Authorized redirect URIs** on your OAuth client in the Google console.
4. **GitHub repo → Settings → Secrets and variables → Actions** → add `APP_URL`
   and `CRON_SECRET`. The workflow won't run without them.
5. **Actions tab → Sync → Run workflow** to confirm it works before trusting the
   schedule.

Note: GitHub disables scheduled workflows on repos with no activity for 60 days.
A commit or a manual run re-arms it.

## PWA / phone

Already wired: `src/app/manifest.ts`, `public/sw.js`, `public/offline.html`, and the
icon set (regenerate with `python3 scripts/make-icons.py`).

Once deployed, open the Vercel URL in **Safari on iOS → Share → Add to Home
Screen**. You get a full-screen app icon with no browser chrome. The service
worker is deliberately conservative — static assets are cached, but pages and
API responses are network-only, because a dashboard showing stale meetings is
worse than one showing a spinner, and a cached authenticated response is a leak
vector on a shared device.

Native iOS later, if you want it: **Expo + React Native talking to Supabase
directly.** No new backend — RLS already enforces per-user isolation at the
database, so the phone is just another client of the same Postgres. Account
linking still opens this web app in an `SFSafariViewController` and deep-links
back.

## Cost

$0/month. Vercel Hobby, Supabase free (the 15-min cron keeps it from pausing after
7 idle days), GitHub Actions (~100 of 2,000 free minutes), Open-Meteo, and Google
APIs well inside free quota.

## Build order

1. ✅ Scaffold, schema, RLS, OAuth linking, sync engine, all tabs
2. Connect all four accounts, verify sync
3. Add lat/lon to your profile row to switch weather on
4. Habit create/log UI (read-only for now)
5. Complete-task action wired to `TaskProvider.completeTask`
6. Better `needs_reply` heuristics
7. `ClaudeBriefingGenerator` if the template reads too robotic
8. PWA manifest or Expo wrapper for the phone
