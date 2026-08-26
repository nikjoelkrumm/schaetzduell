# Supabase setup

The app needs a real Supabase project — there's no demo/shared one. This
walks through creating one and wiring it to `app/`.

## 1. Create the project

1. [database.new](https://database.new) → create a project (free tier is enough
   to start — see the cost note in `ARCHITECTURE.md`).
2. Note the **Project URL** and the **anon public key** from
   Project Settings → API. You'll need both in step 4.
3. Enable `pg_cron`: Database → Extensions → search "pg_cron" → Enable.
   (`0001_extensions_and_enums.sql` also tries to enable it via SQL; if your
   role lacks permission to do that directly, enabling it here first fixes it.)

## 2. Run the migrations

In the SQL Editor, run every file in `supabase/migrations/` **in filename
order** (`0001_…` through `0010_…`), each as its own query. They're plain SQL,
no CLI required — though if you have the
[Supabase CLI](https://supabase.com/docs/guides/local-development) set up
against this project, `supabase db push` works too.

Then run everything in `supabase/seed/` in order (`001_…` through `004_…`).
`002_questions.sql` is the big one (375 rows, generated from
`project/uploads/Schätzduell/schaetzduell-verbessert.html`'s question array —
see `ARCHITECTURE.md` for how). `004_bootstrap.sql` creates *this* calendar
week's challenge immediately, so you don't have to wait for the Monday-00:00
cron tick to see something in the app.

If anything errors partway through, migrations and seeds are safe to re-run
from the top — `create table if not exists`, `create or replace function`,
`drop policy if exists`, and `on conflict do nothing` make the whole set
idempotent.

**Already ran an earlier version of this?** `supabase/combined_setup.sql`
always has every migration + seed up to date, so re-running it in full is
safe and picks up anything new. If you'd rather not re-run the whole thing,
there are also small standalone update files for each round of additions:
`update_002_matchmaking.sql` (friend requests + random-opponent matchmaking,
migrations `0008`–`0009`) and `update_003_avatar.sql` (customizable avatars,
`0010`).

## 3. Turn on Realtime for three tables

Database → Replication → toggle Realtime on for `notifications`,
`duel_rounds`, and `duel_guesses`. (`0007_realtime.sql` tries to do this via
`alter publication supabase_realtime add table …`; if your project's
publication has a different name, use the dashboard toggle instead.)

Without this, the app still works — you just won't see the live "opponent
just played their round" update or the in-app push banner until the next
manual refresh.

## 4. Configure Auth

Authentication → Providers:

- **Email** is on by default. Under Authentication → Settings, decide whether
  you want "Confirm email" on (safer, but a fresh `signUp()` won't have a
  session until the user clicks the confirmation link — the Auth screen
  handles this, it just won't redirect to `/home` until then) or off (instant
  session, simpler to demo).
- **Magic Link** uses the same Email provider — nothing extra to enable.
- **Anonymous sign-ins**: Authentication → Settings → enable "Allow anonymous
  sign-ins". This is what "Erst mal ohne Konto spielen" uses.
- **Apple / Google**: not configured by anyone yet. The buttons on the Auth
  screen are wired to call `supabase.auth.signInWithOAuth()` and will show an
  inline "not set up yet" message until you register the app with
  [Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple) and
  [Google](https://supabase.com/docs/guides/auth/social-login/auth-google)
  and add the resulting client id/secret under Authentication → Providers.
  Nothing else in the app needs to change once you do.
- Authentication → URL Configuration → add your dev URL (e.g.
  `http://localhost:5173`) and your deployed URL to "Redirect URLs" — magic
  links and OAuth both need this.

## 5. Wire up the app

```
cd app
cp .env.example .env.local
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from step 1, then:

```
npm install
npm run dev
```

Without `.env.local`, the app still boots — onboarding and the auth screen
render, but anything backend-backed shows a "Backend nicht verbunden" panel
instead of crashing (see `BackendGate` in `src/components/BackendGate.tsx`).

## 6. Verify

- Sign up with email+password (or go in as a guest). A `profiles` row should
  appear automatically (Table Editor → profiles) — that's the
  `handle_new_user()` trigger from `0005_functions.sql`.
- Home should show "Woche 35" (or whatever the current ISO week is) with 5
  questions from `get_week()`.
- Two accounts (two browsers, or one normal + one incognito) can friend each
  other via invite codes and start a duel.

## What's genuinely real vs. documented follow-up

Real: server-authoritative scoring, RLS, the weekly cron rotation, duels with
Realtime, leagues with promotion/relegation, in-app push over Realtime,
GDPR export/delete.

Documented but not built here (see `ARCHITECTURE.md`'s "What's next"): OS-level
push via APNs/FCM (needs a native Capacitor shell + device tokens), Apple/Google
OAuth (needs credentials only you can create), and real in-app purchases (the
original project notes explicitly say not to build this yet).
