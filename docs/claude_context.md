# Life Dashboard — Full Context Handoff

**Purpose of this file:** everything a fresh Claude (on a different account, with no
project history) needs to pick this project up cold. It consolidates the four docs that
lived in the old Claude project: `current-state.md`, `architecture.md`,
`google-cloud-setup.md`, `repo-readme.md`.

**Owner:** Usman Ali · **Context written:** 2026-08-30
**Status:** deployed to Vercel production, four Google accounts connected, in daily use.

> **How to read this:** §1–§4 are the live operational facts. §5–§10 are the design
> rationale — still accurate, but they describe *why*, not *what exists today*. If §5–§10
> and §1–§4 ever disagree, §1–§4 wins.

---

## 0. Working agreement with the owner

Carry these over — they were learned the hard way.

- **Never read or echo `.env.local`.** Standing instruction after an incident where
  sourcing it printed secrets. Parse values without printing them, or ask.
- Usman is a **backend engineer** — explain mechanisms, not just steps — but is **new to
  cloud consoles**, so console navigation needs to be concrete and click-by-click.
- **Don't hand back work that isn't genuinely blocked.** Real blocks: passwords,
  `.env.local`, GitHub/Vercel secrets, `git push` (no network from the file bridge), and
  `.github/workflows/` (protected path). Everything else should just get done.
- **Don't infer identity or config from artefacts lying around.** Reusing the author of an
  existing commit is what put the wrong email on three commits and blocked a deploy. Ask.

---

## 1. What this is

A personal dashboard aggregating **multiple Google accounts** (Cornell, NYU, personal,
work) into one page.

- **Home** — today's briefing: agenda across all calendars, inbox needing a reply, tasks
  due, weather + what-to-wear
- **Calendar** — merged multi-account agenda, conflict detection
- **Inbox** — triage (unread/important, awaiting your reply, follow-ups you owe)
- **Tasks** — due today / overdue / this week
- **Habits** — manually tracked streaks and metrics

Phase 1 is single-user. Phase 2 is multi-user, so it is built with real per-user auth from
day one — no hardcoded credentials, ever.

---

## 2. Where everything lives

| | |
|---|---|
| Repo | `git@github.com:usmanali-arshi/life-dashboard.git`, branch `main` |
| Local | `~/Desktop/life-dashboard-app/life-dashboard` |
| Production | `life-dashboard-git-main-arshi8.vercel.app` (deploys on push to `main`) |
| Database | Supabase — **shared between local dev and production** |
| Scheduled sync | GitHub Actions, `*/15 * * * *`, secrets `APP_URL` + `CRON_SECRET` set |
| Git identity | **`Usman Ali <ua383@nyu.edu>`** — the GitHub-linked address |
| Weather | Open-Meteo (no key, no signup) |

**Vercel URL trap:** `life-dashboard-<hash>-arshi8.vercel.app` is a *per-deploy immutable*
URL frozen to one build forever. It will never show new code. Cost a round of "the deploy
didn't work" debugging. Always check `-git-main-`.

**Commit email must be `ua383@nyu.edu`.** Vercel *blocks* — not fails, **blocks before
building** — any deployment whose commit email doesn't resolve to a GitHub account.
Commits authored as `usali@noon.com` (a work address being lost) were blocked with
`Duration —` and no build log, which looks like a build failure and isn't. History was
rewritten on 2026-08-24 to put all commits on the NYU address; global git config now
matches.

### Repo layout

```
src/
  app/
    page.tsx                    Home — briefing, stat tiles, agenda, triage
    calendar/ inbox/ tasks/ habits/ settings/ login/ prep/
    api/auth/google/start/      begin account linking (once per account)
    api/auth/google/callback/   token exchange, encrypt + store refresh token
    api/cron/sync/              CRON_SECRET-protected, called by GitHub Actions
  lib/
    env.ts          fail-fast config + ENABLE_GMAIL flag
    crypto.ts       AES-256-GCM for refresh tokens at rest
    queries.ts      read layer — Postgres only, never Google inline
    dates.ts        floating dates (read in UTC)  ← see §4
    tz.ts           real instants (read in user's zone)  ← see §4
    google/oauth.ts authorize / exchange / refresh
    providers/      CalendarProvider · MailProvider · TaskProvider + Google impls
    briefing/       BriefingGenerator interface + template impl; freetime.ts
    scheduling/     slots.ts (free-gap finder) + assistant.ts (phrasing)
    llm/            Anthropic + OpenAI behind one interface (BYO key)
    sync/run.ts     the sync engine
  middleware.ts     refreshes the Supabase session cookie
supabase/migrations/0001_init.sql … 0006_*.sql   (all run against Supabase)
.github/workflows/sync.yml      */15 cron
```

---

## 3. What is built

Everything in the original build order (§10) is shipped. Beyond that:

**Scheduling assistant** — "Can I fit it in?" panel on Overview. `lib/scheduling/slots.ts`
finds free gaps over an 8-day horizon; `assistant.ts` phrases the answer.

> **The load-bearing decision:** slot arithmetic is *never* the LLM's job. A model asked to
> subtract meetings from a day will confidently return a slot that overlaps your 3pm, and
> you won't find out until you miss it. The route computes a deterministic answer first,
> always; the model only rewords it, and every LLM failure path falls back to the
> deterministic answer with a warning.

**Bring-your-own LLM key** — `lib/llm/` wraps Anthropic and OpenAI behind one interface.
Keys are verified against the provider before storage, encrypted with the same AES-256-GCM
machinery as the Google refresh tokens, and never returned to the browser. Cost lands on
the key's owner, which is what keeps this free to run at any user count.
Settings → *Assistant*.

**Interview prep sheets** (`/prep`) — typed content in the repo rather than MDX, so a
half-written sheet fails typecheck instead of rendering an empty section.

**Task UX** — account filter applied in SQL (not the client, so derived counts can't
disagree with the visible list); date buckets Overdue/Today/Tomorrow/Later/Unscheduled;
per-block select-all and bulk complete; add/edit/complete per account; inline task-list
rename via `tasklists.patch`; account+list grouping laid out as columns; add-task
confirmation naming the destination.

---

## 4. Things that bit us — do not re-derive these

**Floating dates vs instants.** `lib/dates.ts` vs `lib/tz.ts` is the most important
distinction in the codebase. Google's date-only due comes back as `T00:00:00Z`; reading it
in `America/New_York` lands on the *previous day*. Due dates are floating dates and must be
read in **UTC**; "today" is a real instant read in the user's zone. Mixing them shifted
every due date a day earlier for anyone west of UTC.

**Two different DAY_END constants, deliberately not merged.**
`briefing/freetime.ts` ends at **midnight** — it *measures* unclaimed time.
`scheduling/slots.ts` ends at **22:00** — it *recommends* when to do something, and 11:15pm
is bad advice rather than a wrong sum.

**Group tasks by provider list id, never by list title.** Two accounts can each own a list
called "Personal"; name-keying merges them, after which a rename appears to hit the wrong
one.

**Write to Google first, then the local mirror.** `project_name` is denormalised onto every
task row and the cron is up to 15 min out, so a provider-only write leaves stale text on
screen that reads as a failure.

**Optimistic UI that reverts without explanation is worse than no optimism.** Cost a day on
the °C/°F toggle silently rolling back because migration `0005` hadn't been run.

**Account colours are a fixed 8-slot palette, not a free picker** — validated for
deuteranopia/protanopia separation and contrast in both themes. A free hex breaks both
invisibly to the person choosing it.

**Every failure in the build so far was configuration, never application logic** — wrong
env var names, unrun migrations, a missing profile row, stale `.next`, `https` vs `http` on
localhost, a commit email GitHub couldn't resolve. The OAuth flow, encryption and sync
worked first time whenever they got to run.

### Local dev gotchas

- `APP_URL` must be `http://localhost:3000`. `https` gives `ERR_SSL_PROTOCOL_ERROR`.
- Run `npm run dev` in a terminal you leave open; stop it with `Ctrl+C` **there**. Killing
  the npm wrapper from elsewhere orphans `next-server`, which then gets `SIGTTIN`/`SIGTTOU`
  from the kernel and is **stopped, not killed** — it holds port 3000 and answers nothing.
  `ps -o stat` showing `T` is the tell. `ERR_TIMED_OUT` (not `CONNECTION_REFUSED`) on
  localhost means something accepted the socket and went silent.
- Build with plain `next build`, never `--no-lint` — Vercel lints, so `--no-lint` locally
  hides exactly the errors that will fail the deploy.
- The mounted-filesystem bridge **cannot delete files**. Git can't clean up its own
  `index.lock`/`HEAD.lock` through it, so locks accumulate; move them to `_to_delete/`
  (gitignored). `rebase` and `filter-branch` need real deletes — pass `-d /tmp/...` or run
  them from a real terminal.
- `filter-branch --all` also rewrites `refs/remotes/origin/*`, after which
  `--force-with-lease` compares against a phantom and rejects the push. `git fetch origin`
  first.

### Manual sync trigger

```bash
curl -X POST localhost:3000/api/cron/sync -H "Authorization: Bearer $CRON_SECRET"
```

---

## 5. Open items

- [ ] **Secret rotation outstanding**: `TOKEN_ENC_KEY`, Supabase secret key. (Google client
      secret already rotated; `CRON_SECRET` was set fresh with the GitHub secrets.)
      Rotating `TOKEN_ENC_KEY` invalidates stored refresh tokens →
      `delete from linked_accounts;` and reconnect all four in one sitting.
- [ ] Habits tab has no add/log UI.
- [ ] `needs_reply` is a crude heuristic.
- [ ] Assistant can't create calendar events (would need the `calendar.events` scope).
- [ ] The multi-user auth checklist (§9) is untouched.
- [ ] *Optional, low value:* a hardened `sync.yml` was drafted (skip-with-warning when
      secrets are absent, 401/403 vs 404 diagnosis, one cold-start retry) and never saved.
      The secrets exist now so the stock workflow passes — don't chase this.

**Known future trap:** GitHub silently disables scheduled workflows after 60 days with no
commits. If syncs stop for no reason, look for the disabled banner in the Actions tab
before debugging code.

---

## 6. Stack & why

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router), TypeScript | Server components + route handlers keep OAuth exchange, refresh and Google calls server-side. Expo later can reuse the API routes. |
| Hosting | Vercel Hobby (free) | Zero-config Next deploys, preview URLs, serverless functions. |
| Database | Supabase (free) | Postgres + Auth + Row Level Security. |
| Auth (app login) | Supabase Auth | Sessions, JWTs, multi-user on day one. |
| Auth (data accounts) | Own Google OAuth flow | Deliberately separate — see §7. |
| Scheduled sync | GitHub Actions cron | Vercel Hobby crons are **daily-only**, ±59 min. GitHub gives every-15-min free. |
| Weather | Open-Meteo | Free, no key, no signup. |
| Briefing text | Template behind `BriefingGenerator` | Rule-based v1 is free, instant, deterministic, testable. LLM swap is one file + an env var. |

**Not GitHub Pages** — static files only: no server for the authorization-code exchange
(so `client_secret` would ship in the browser bundle), refresh tokens in `localStorage`, no
cron, no database. Right tool for docs, wrong tool for anything holding a Gmail refresh
token.

### Decisions log

| Date | Decision |
|---|---|
| 2026-08-18 | Next.js on Vercel + Supabase Postgres, not GitHub Pages. |
| 2026-08-18 | Cron in GitHub Actions, not Vercel — Hobby crons are daily-only. |
| 2026-08-18 | App login and data-account linking are separate OAuth flows (N Google accounts per user). |
| 2026-08-18 | Gmail ships in v1 behind `ENABLE_GMAIL`; CASA gate accepted as a phase-2 problem. |
| 2026-08-18 | Briefing template-generated behind `BriefingGenerator`; LLM swap deferred. |
| 2026-08-18 | App login is email + password, not magic link — corporate mail scanners burn single-use links. |
| 2026-08-18 | Email confirmation OFF during single-user phase; ON before multi-user, with neutral signup copy. |
| 2026-08-24 | Git history rewritten onto `ua383@nyu.edu` so Vercel will build. |

### Architecture

```
┌──────────────────────────────────────────────────────┐
│  Next.js on Vercel                                    │
│  /app          RSC — reads ONLY from Postgres,        │
│                never calls Google inline. <200ms.     │
│  /api/auth/google/{start,callback}   account linking  │
│  /api/cron/sync                      CRON_SECRET      │
└───────────────┬──────────────────────────────────────┘
        ┌───────▼────────┐        ┌──────────────────┐
        │ Supabase       │        │ GitHub Actions   │
        │ Postgres + RLS │◄───────│ */15 * * * *     │
        └───────┬────────┘        │ POST /api/cron/  │
                │                 │      sync        │
     ┌──────────┴───────────┐     └──────────────────┘
     │ Provider adapters    │
     │  GoogleCalendar · GoogleGmail · GoogleTasks · OpenMeteo │
     └──────────────────────┘
```

**Cache-then-render.** The sync job pulls from Google every 15 minutes and writes
normalized rows to Postgres. Pages read only from Postgres. Instant loads, survives Google
rate limits and outages, and gives history (habit streaks, "how many meetings last week")
which a live-fetch design cannot do.

---

## 7. Multi-account model — the important bit

Two concepts that are easy to conflate:

- **App user** — one row in `users`. One login.
- **Linked account** — N rows in `linked_accounts`. Cornell, NYU, personal, work.

Log in **once**, then hit "Add account" as many times as you like; each run sends you
through Google's consent screen with `prompt=consent&access_type=offline` and stores a
*separate* refresh token per account.

We do **not** use Supabase's built-in Google sign-in provider for the data tokens — it
manages one provider identity per user and will fight you on the 4th account. Login and
data access are separate flows that happen to use the same identity provider.

```sql
create table linked_accounts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references users(id) on delete cascade,
  provider          text not null,          -- 'google' | 'todoist' | 'notion' | ...
  provider_user_id  text not null,          -- Google 'sub' claim
  email             text not null,
  label             text,                   -- 'Cornell', 'Work'
  color             text,                   -- calendar dot color in the UI
  refresh_token_enc bytea not null,         -- AES-256-GCM, key in env
  scopes            text[] not null,
  status            text not null default 'active',  -- 'active'|'reauth_required'
  created_at        timestamptz default now(),
  unique (user_id, provider, provider_user_id)
);
```

Refresh tokens are encrypted at rest with AES-256-GCM, key in a Vercel env var. Access
tokens are never persisted — short-lived, re-derived per sync.

**Other tables:** `calendar_events` (normalized, `(linked_account_id, external_id)` unique,
soft-delete so cancellations disappear) · `email_threads` (**metadata and snippets only,
never full bodies**) · `tasks` (provider-agnostic shape) · `habits`, `habit_entries` ·
`sync_state` (per account/resource cursor: `syncToken` for Calendar, `historyId` for Gmail)
· `briefings` (one per user per day, cached).

RLS on every table: `user_id = auth.uid()`. Multi-user safety enforced by the database, not
by remembering to write a `WHERE` clause.

### Provider abstraction

```ts
export interface TaskProvider {
  readonly id: 'google_tasks' | 'todoist' | 'notion' | 'asana' | 'native';
  listTasks(account: LinkedAccount, since?: Date): Promise<NormalizedTask[]>;
  completeTask(account: LinkedAccount, externalId: string): Promise<void>;
  createTask(account: LinkedAccount, task: NewTask): Promise<NormalizedTask>;
}

export interface NormalizedTask {
  externalId: string;
  title: string;
  notes?: string;
  due?: Date;            // date-only providers get midnight local
  completed: boolean;
  priority?: 1 | 2 | 3 | 4;
  projectName?: string;
  url?: string;          // deep link back to the source app
}
```

Adding Todoist = one new file plus a registry row. UI and DB don't change. Same for
`CalendarProvider` (Google now, Microsoft Graph later for Outlook users).

### The sync job

`POST /api/cron/sync` — rejects any request without `Authorization: Bearer $CRON_SECRET`.

1. Select accounts where `status='active'` and `last_synced_at < now() - interval '10 minutes'`
2. Per account: decrypt refresh token → exchange for access token → adapters in parallel
3. **Calendar**: incremental via `syncToken`; on HTTP 410 fall back to a full window resync (−7d to +30d)
4. **Gmail**: `users.history.list` from stored `historyId`; first sync pulls last 7 days. Query `is:unread OR is:important`.
5. **Tasks**: full list — volume is tiny, incremental isn't worth it
6. Upsert, advance `sync_state`, stamp `last_synced_at`
7. On `invalid_grant` → `status='reauth_required'`, show a "reconnect Cornell" banner rather than failing silently

Idempotent. `Promise.allSettled`, not `Promise.all` — one bad account never blocks others.
The daily briefing is a separate 6am job so it's sitting in the DB when the page opens.

---

## 8. Gmail: the compliance story

**Decision: Gmail ships in v1**, behind `ENABLE_GMAIL`, so a public deployment can run
Calendar + Tasks only without touching code.

| Bucket | Scopes | Cost |
|---|---|---|
| Non-sensitive | `openid`, `email`, `profile` | Nothing |
| **Sensitive** | `calendar.readonly`, `tasks` | OAuth verification only — free, days-to-weeks |
| **Restricted** | `gmail.readonly` | Verification **+ CASA security assessment** |

**Why it's worth it:** inbox triage is the highest-value surface (calendar says where to
be; email says what you owe people), multi-account merging matters most here, and email is
the richest signal for the briefing.

**What it costs:** the CASA gate at scale; a much larger blast radius (hence metadata +
snippet only); a scarier consent screen; fiddlier incremental sync (`historyId` expires);
an *annual* recurring burden once verified.

**Mitigations built in from day one** — cheap now, exactly what CASA asks about later:
`ENABLE_GMAIL` gates scope + adapter + sync + tab; `gmail.readonly` never `gmail.modify`;
metadata + snippet only (`format=metadata`, so Google physically won't send bodies);
AES-256-GCM at rest; nightly purge of `email_threads` older than 30 days; adapter behind
`MailProvider` so Graph slots in later.

**Path to multiple users:**

- **Immediately (week one):** move the OAuth app from **Testing** to **In production**. In
  Testing, refresh tokens expire after 7 days.
- **Up to 100 users:** publish unverified, accept the interstitial, add each user as an
  allowed user. Fine for you, friends, private beta.
- **Beyond 100:** brand verification (~2–3 business days) → data access verification
  (privacy policy, homepage on a verified domain, demo video) → **CASA** (OWASP ASVS-based
  self-assessment, then scan or third-party lab by tier, remediate, Letter of Assessment).
  Google doesn't publish pricing — you pay the lab. Self-service tiers cheap/free;
  lab-assessed commonly high-hundreds to several-thousand USD. **Recertify annually.**
  Budget weeks, not days.
- **Escape hatch:** flip `ENABLE_GMAIL=false` for the public deployment. Calendar + Tasks +
  habits are sensitive-scope only — verification, no CASA, no recert. Keep running the
  Gmail build yourself under a separate personal OAuth client. That's why the flag exists.

---

## 9. Auth: state and the multi-user launch checklist

### Why password, not magic link

The scaffold shipped with magic-link login and it failed immediately, for two structural
reasons:

1. **Corporate mail scanners burn single-use links.** Defender, Proofpoint and most
   enterprise filters pre-fetch every URL in inbound mail. That fetch *redeems* the
   one-time token, so the user clicks a 30-second-old link and gets `otp_expired`. Happens
   every time on filtered domains — which is most work addresses, including `@noon.com`.
2. **Supabase's built-in SMTP is rate-limited** to a couple of messages per hour and lands
   in spam often enough to be unreliable for a login path.

Login is **email + password**, magic link kept as a secondary option. `/auth/callback`
exists and correctly exchanges the PKCE `code` for a session.

### Email confirmation is currently OFF

Deliberate, single-user phase. Must be **ON** before anyone else signs up.

Design around this: with confirmation ON, **Supabase returns a decoy success when you sign
up with an address that already exists.** It will not tell the client "that email is taken."
Not a bug — do not work around it. The signup endpoint is unauthenticated, so any response
distinguishing "new" from "existing" is a yes/no oracle for *does this person have an
account here*, which scripted yields a verified user list for credential stuffing and
targeted phishing. Same reason sign-in says "invalid email or password."

Older Supabase versions leaked this via an empty `identities` array; that was closed on
purpose. **Do not reintroduce enumeration by sniffing response shape.** The real signal
belongs in the email — the address owner gets "someone tried to sign up with your email;
you already have an account, here's a reset link."

### Launch checklist — auth (untouched)

- [ ] **Turn Email confirmation ON** (Authentication → Sign In / Providers → Email)
- [ ] **Rewrite signup copy to be enumeration-neutral**, e.g. *"If that email is new you're
      all set. If it already has an account, we've emailed you a sign-in link."*
- [ ] **Remove the dev-only error hints** in `login/page.tsx` — they become an enumeration
      oracle the moment confirmation is on
- [ ] **Add a prominent "Forgot password?" flow** — with the decoy response, reset is the
      actual path for an already-registered user
- [ ] **Replace Supabase's built-in SMTP** with Resend / Postmark / SES
- [ ] **Set Site URL and the redirect allow-list** to the production domain
- [ ] **Enable leaked-password protection** (HaveIBeenPwned) + a sane minimum length
- [ ] **Review auth rate limits** — defaults are too loose for a public signup form
- [ ] Consider **"Sign in with Google"** as the primary app login — removes the password,
      reset flow and confirmation email from the critical path entirely

This is separate from the Google OAuth verification in §8. That gates access to *user
data*; this gates access to *the app*.

---

## 10. Google Cloud + Supabase setup (click-by-click, for a rebuild)

Google renamed these screens in 2025 — "APIs & Services → OAuth consent screen" is now
**Google Auth Platform**, split into Branding / Audience / Clients / Data Access.

1. **Create the project** at console.cloud.google.com, signed in with the account that
   should *own* it. **Use a personal Gmail, not Cornell/NYU/work** — university and
   corporate Workspace tenants often block third-party OAuth clients. Name `life-dashboard`.
   Confirm the project dropdown shows it before continuing.
2. **Enable APIs** (APIs & Services → Library): Google Calendar API, Gmail API, Google
   Tasks API, People API (optional). Enabling only makes an API callable; consent grants access.
3. **Branding**: app name `Life Dashboard`, support + developer contact emails. Logo and
   domains matter at verification, not now.
4. **Audience**: User type **External** ("Internal" is Workspace-only and would restrict you
   to one tenant). Add all four Google accounts as test users. Then **Publish app**.
5. **Data Access** — exactly five scopes: `openid`,
   `.../auth/userinfo.email`, `.../auth/calendar.readonly` (sensitive),
   `.../auth/tasks` (sensitive, read-write on purpose so you can tick tasks off),
   `.../auth/gmail.readonly` (restricted). **Do not add `gmail.modify`.**
6. **Clients → Create client**: Web application, name `life-dashboard-web`, redirect URI
   `http://localhost:3000/api/auth/google/callback` — no trailing slash. Add the real
   `https://<app>.vercel.app/api/auth/google/callback` only *after* deploying. Redirect URIs
   are matched as exact strings. Copy the Client ID and secret.
7. ⚠️ **Publish to Production immediately.** In Testing mode refresh tokens expire after 7
   days and you'd re-authorize four accounts weekly. Publishing doesn't submit you for
   verification, cost anything, or require a privacy policy. You stay unverified: users see
   "Google hasn't verified this app" (**Advanced → Go to Life Dashboard (unsafe)**), capped
   at 100 users, and **refresh tokens no longer expire**.

### `.env.local`

```bash
GOOGLE_CLIENT_ID=<step 6>
GOOGLE_CLIENT_SECRET=<step 6>
APP_URL=http://localhost:3000

TOKEN_ENC_KEY=<openssl rand -base64 32>
CRON_SECRET=<openssl rand -hex 32>

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=

ENABLE_GMAIL=true
```

`TOKEN_ENC_KEY` encrypts refresh tokens at rest. **Losing or rotating it makes every stored
token undecryptable** and forces reconnecting all accounts. Keep a backup. Never commit —
`.env.local` is gitignored.

### Supabase

New project, region closest (`us-east-1` for NYC), save the database password.
**Project Settings → API Keys** — Supabase replaced the old `anon`/`service_role` JWTs
(legacy pair deprecated end of 2026):

| Dashboard label | Looks like | Goes in |
|---|---|---|
| Project URL | `https://xxxx.supabase.co` | `NEXT_PUBLIC_SUPABASE_URL` |
| Publishable key | `sb_publishable_…` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| Secret key | `sb_secret_…` | `SUPABASE_SECRET_KEY` |

The secret key may need creating; it's shown once. ⚠️ It **bypasses RLS entirely** —
server-side only, never in a `NEXT_PUBLIC_` var, never in a client component. The
publishable key is designed to be public; RLS protects the data, not the key.

Then SQL Editor → run the migrations `0001`–`0006`.

Free-tier note: Supabase pauses after 7 days of zero activity; the 15-min cron keeps it awake.

### Deploy

1. vercel.com → Add New → Project → import the repo (framework auto-detects).
2. Add every var from `.env.example` under Settings → Environment Variables. `APP_URL` =
   the real `https://<app>.vercel.app`, no trailing slash.
3. Deploy, then add the production callback URI to the OAuth client.
4. GitHub repo → Settings → Secrets and variables → Actions → add `APP_URL` and
   `CRON_SECRET`. The workflow won't run without them.
5. Actions → Sync → Run workflow, to confirm before trusting the schedule.

### When it goes wrong

| Error | Cause |
|---|---|
| `redirect_uri_mismatch` | URI doesn't byte-match the console list. Trailing slash, http/https, port. |
| `access_blocked: app not verified` | Expected while unverified. Advanced → Go to Life Dashboard (unsafe). |
| `admin policy enforced` | Cornell/NYU/work Workspace blocks third-party OAuth clients. Their admin must allowlist your client ID. Not fixable from your side. |
| No `refresh_token` in the response | Google only returns one on *first* consent. The app sends `prompt=consent&access_type=offline` to force it. Otherwise revoke at myaccount.google.com/permissions and reconnect. |
| `invalid_grant` on refresh | Token revoked, expired (Testing mode), or wrong `TOKEN_ENC_KEY`. App marks the account `reauth_required`. |

---

## 11. Cost

| | Free tier | Where it breaks |
|---|---|---|
| Vercel Hobby | 100 GB bandwidth, unlimited functions | Non-commercial only. Monetize → Pro $20/mo. |
| Supabase Free | 500 MB DB, 50k MAU | Pauses after 7 idle days — the cron keeps it awake. |
| GitHub Actions | 2,000 min/mo private | 15-min cron ≈ 100 min/mo. |
| Google APIs | Generous | — |
| Open-Meteo | Free non-commercial | — |
| LLM API | Pay-as-you-go, BYO key | ~$0.30/mo for a daily briefing. Optional; cost lands on the key's owner. |

**$0/month for personal use.**

---

## 12. Next steps if you're picking this up

1. Rotate `TOKEN_ENC_KEY` and the Supabase secret key (§5) — plan for reconnecting all four
   accounts in one sitting.
2. Habits add/log UI.
3. Better `needs_reply` heuristics.
4. `calendar.events` scope so the assistant can create events.
5. The §9 auth checklist, before anyone else signs up.
6. PWA manifest or Expo wrapper for the phone.
