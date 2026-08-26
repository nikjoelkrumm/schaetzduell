# Architecture

This carries forward the "Backend-Blatt" from the Claude Design handoff
(`project/Schätzduell App.dc.html`, screen 1b) into what's actually built in
`supabase/` and `app/`. Where the real implementation deviates from that
sketch, it's called out explicitly below rather than silently.

## Stack

**Supabase** (Postgres + Auth + Realtime + `pg_cron`), for the reason the
original design gave: an asynchronous duel needs a relational store with
row-level security, auth with email/password + magic link + (eventually)
Apple/Google, a channel that pushes a change to the other device, and a
cron for the weekly rotation — one project, no bespoke server, still plain
Postgres underneath so there's no data-model lock-in.

**Frontend**: React + TypeScript + Vite (`app/`), plain CSS matching the
design's Petrol/Amber/Archivo tokens (`app/src/styles/tokens.css`) rather
than a component library — the source design is essentially hand-styled per
element, so that's what a pixel-faithful port looks like in React too.
React Router for real URLs per screen instead of the design prototype's
internal `screen` state machine (`/home`, `/duelle/:id`, …) since this is a
real app, not a click-through mock.

## The one rule everything else follows

**The answer never leaves Postgres before a guess is scored.** The client
gets a question's text, unit, and category — never `questions.answer`. This
is enforced twice, deliberately redundantly:

1. **Column privileges**: `revoke select … grant select (id, cat_id, text,
   unit, volatile, source_url, checked_at)` on `questions` — the `answer`
   column is simply not in the client's grant, regardless of RLS.
2. **No direct writes to scored tables**: `attempts`, `duel_guesses`, etc.
   have RLS `SELECT` policies but deliberately no `INSERT`/`UPDATE` policies
   for `authenticated`. The only way to write a score is through a
   `security definer` RPC (`submit_attempt`, `submit_duel_guess`, …) that
   reads the answer server-side, computes the score itself, and only then
   writes. A client can query these tables but can't forge a score into
   them directly.

`score_guess(guess, answer)` in `0005_functions.sql` is the logarithmic
scoring formula ported 1:1 from the existing `schaetzduell-verbessert.html`
build's `accuracy()` — same formula, same bands, so scores match what players
of the original build are used to.

## Data model

Matches the design's sketch almost exactly — `profiles`, `questions`,
`weeks`, `attempts`, `duels`, `duel_rounds`, `duel_guesses`, `friendships`,
`league_seasons`, `standings`, `badges`, `devices` — plus two additions the
prototype didn't need to model because it was faking the backend:

- **`categories`** — a real table instead of a hardcoded client-side array,
  so `questions.cat_id` is a real foreign key.
- **`notifications`** — the actual delivery mechanism for "push" (see below).
- **`profile_badges`**, **`question_reports`** — named directly in the
  design's rpcs/tables list but not spelled out as their own tables there.
- **`profile_public`** — a view exposing only `id, name, xp, level, streak,
  created_at`. Cross-user reads (an opponent's name in a duel, a friend's
  streak, the leaderboard) go through this, never through `profiles`
  directly, which stays restricted to "your own row only" via RLS. The view
  is intentionally *not* `security_invoker` — it runs as its owner so it can
  see every row despite the base table's RLS, but it can only ever return
  the five safe columns because that's all its query selects.

## Push: what's real and what isn't

The design's push banner is simulated in the prototype (`this.firePush()`
just sets local state). Here, **half of it is real**: `send_push()` inserts a
row into `notifications`; the client subscribes to that table over Realtime
(`PushBanner.tsx`) and renders the banner the moment a row lands, while the
tab is open. `create_duel()` and `submit_duel_guess()` call it internally
when an opponent should be nudged.

What's *not* built: actual OS-level push (APNs/FCM) when the app isn't open.
That needs a native shell with device tokens — the `devices` table already
has the columns for it — which only makes sense once there's a Capacitor
build to register a token from (see `project/uploads/Schätzduell/_extracted/claude-code-start.md`,
which explicitly sequences that as later-phase native work). Building a fake
version of that now would just be more code to throw away.

`send_push()`'s `EXECUTE` privilege is revoked from `authenticated` (see
`0006_privilege_lockdown.sql`) — otherwise any signed-in client could spam a
notification into an arbitrary other profile's inbox by calling the RPC
directly with someone else's id. Internal callers still work because a
security-definer function executes as its owner, and an object's owner is
exempt from its own privilege checks.

## Weekly rotation

`rotate_week()` picks one question per category, indexed by
`ISO week number mod 75` (each category has 75 questions) — deterministic
from the calendar, like the original build's Wordle-style "same puzzle for
everyone, no randomness" design, and it comfortably clears the "53 weeks
without a repeat" goal from the project notes since the cycle length (75) is
longer than a year. It repeats on the same calendar week every year rather
than running off a never-repeating global counter — a reasonable MVP
simplification, called out here rather than left implicit.

## Leagues

`close_league_season()` runs hourly (not exactly at the 7-day mark) so a
missed cron tick still settles promptly instead of drifting. Top 5 in a
group promote a tier, bottom 5 (in a group of more than 5) relegate,
everyone else stays; the design didn't specify exact promotion/relegation
counts, so 5-up/5-down out of a 30-person group was chosen to match
Duolingo-style leagues at a similar scale. `refresh_standings()` runs every
5 minutes and sums `attempts`/`duel_guesses` scores within the current
season's date range — this is the "matview, 5-Min-Cron" line from the
design's table sketch, implemented as a plain scheduled `UPDATE` rather than
an actual Postgres materialized view, since a real matview would need its
own manual `REFRESH` scheduling anyway and this is simpler for the same
result at this scale.

## Local-save migration — changed from the original sketch

The design's rpc list includes `import_local_save(json)` for carrying a
pre-account browser save into a new account. It's implemented
(`0005_functions.sql`) and left in place, but the app **doesn't call it
automatically**, for a concrete reason: `schaetzduell-verbessert.html` is a
pass-and-play, multi-profile-per-device build with no notion of a single
persistent player identity — there's no reliable `{xp, streak}` shape to
read out of its `localStorage` for *this* new per-account backend. Migrating
fabricated numbers would be worse than migrating nothing.

Instead, "Erst mal ohne Konto spielen" uses Supabase **anonymous auth**
(`signInAnonymously()`), which creates a real `profiles` row immediately —
so a guest's streak and XP already live on the server from the first guess,
not in `localStorage`. Adding an email+password later
(`supabase.auth.updateUser()`) upgrades that same identity in place rather
than migrating data between two different accounts. This is what "der
lokale Spielstand wird beim ersten Login übernommen" turns into once guest
play is already server-backed — a cleaner mechanism than the JSON-migration
RPC the design sketched, not a shortfall against it.

## Question data

`supabase/seed/002_questions.sql` is generated from the `Q` array in
`project/uploads/Schätzduell/schaetzduell-verbessert.html` (375 rows, 5
categories × 75). The `volatile` flag (questions whose numeric answer is a
price, wage, or subscriber count that goes stale) is a keyword heuristic —
see the generator note inline — flagging ~80 questions. The original
project notes already call this open work ("Phase 4: jede Zahl per
Websuche belegen"); this implementation doesn't pretend to have closed that
gap, it just carries the flag through to the schema (`questions.volatile`,
`source_url`, `checked_at`) so a future pass has somewhere to put its
findings, and the Reveal screen shows the "Richtwert" note per design when
`volatile` is true.

## What's next (deliberately not built here)

- **Native push** (APNs/FCM) — needs the Capacitor shell.
- **Apple/Google OAuth** — needs credentials only the project owner can
  create in their developer consoles; the buttons and `signInWithOAuth()`
  calls are already wired, see `SUPABASE_SETUP.md`.
- **Real in-app purchases** — the project's own planning notes
  (`claude-code-start.md`) explicitly say not to build this yet ("Noch nicht
  machen: Werbung, In-App-Käufe"). The Plus screen is fully built visually;
  its subscribe button says so instead of faking a purchase.
- **Question fact-checking** (Phase 4 from the same notes) — unchanged, still
  open, now has a schema to land in.
