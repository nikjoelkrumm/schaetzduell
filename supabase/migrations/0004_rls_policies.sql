-- Schätzduell — row level security.
--
-- General rule: tables that back gameplay outcomes (attempts, duels,
-- duel_rounds, duel_guesses) get SELECT policies for participants only, and
-- deliberately NO insert/update policies for `authenticated` — all writes to
-- those tables go through the security-definer RPCs in 0005_functions.sql,
-- which run as the owning role and bypass RLS. This is what makes the score
-- server-authoritative: a client can query these tables but can't write a
-- fabricated score into them directly.
--
-- Every policy is preceded by a `drop policy if exists` — unlike `create
-- table if not exists` / `create or replace function`, Postgres has no
-- `create policy if not exists`, so this is what makes re-running the file
-- safe.

alter table public.categories enable row level security;
alter table public.profiles enable row level security;
alter table public.questions enable row level security;
alter table public.question_reports enable row level security;
alter table public.weeks enable row level security;
alter table public.attempts enable row level security;
alter table public.duels enable row level security;
alter table public.duel_rounds enable row level security;
alter table public.duel_guesses enable row level security;
alter table public.friendships enable row level security;
alter table public.league_seasons enable row level security;
alter table public.standings enable row level security;
alter table public.badges enable row level security;
alter table public.profile_badges enable row level security;
alter table public.devices enable row level security;
alter table public.notifications enable row level security;

-- categories, questions (safe columns only, see 0003), weeks, badges: public
-- reference data, readable by any signed-in client (incl. anonymous guests).
drop policy if exists "categories are readable" on public.categories;
create policy "categories are readable" on public.categories
  for select to authenticated, anon using (true);

drop policy if exists "questions are readable" on public.questions;
create policy "questions are readable" on public.questions
  for select to authenticated, anon using (true);

drop policy if exists "weeks are readable" on public.weeks;
create policy "weeks are readable" on public.weeks
  for select to authenticated using (true);

drop policy if exists "badges are readable" on public.badges;
create policy "badges are readable" on public.badges
  for select to authenticated using (true);

drop policy if exists "profile badges are readable" on public.profile_badges;
create policy "profile badges are readable" on public.profile_badges
  for select to authenticated using (true);

-- profiles: only your own full row. Cross-user reads go through
-- profile_public (see 0002_tables.sql) which bypasses this on purpose.
drop policy if exists "own profile is readable" on public.profiles;
create policy "own profile is readable" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "own profile is editable" on public.profiles;
create policy "own profile is editable" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- No direct delete policy on purpose: deleting straight from `profiles`
-- would leave an orphaned auth.users row behind. Account deletion goes
-- through delete_my_account() (0005_functions.sql), which removes the
-- auth.users row and lets that cascade down to profiles and everything
-- hanging off it.

-- Only display name and notification opt-in are client-editable; xp, level,
-- streak, is_guest, invite_code, imported_local_save only ever change via
-- security-definer RPCs / triggers.
revoke update on public.profiles from authenticated;
grant update (name, push_opt_in) on public.profiles to authenticated;

-- attempts: read your own history; no direct insert (see submit_attempt).
drop policy if exists "own attempts are readable" on public.attempts;
create policy "own attempts are readable" on public.attempts
  for select to authenticated using (profile_id = auth.uid());

-- duels: read duels you're part of; no direct insert (see create_duel).
drop policy if exists "own duels are readable" on public.duels;
create policy "own duels are readable" on public.duels
  for select to authenticated using (auth.uid() in (a_id, b_id));

drop policy if exists "own duel rounds are readable" on public.duel_rounds;
create policy "own duel rounds are readable" on public.duel_rounds
  for select to authenticated using (
    exists (
      select 1 from public.duels d
      where d.id = duel_rounds.duel_id and auth.uid() in (d.a_id, d.b_id)
    )
  );

-- duel_guesses: you always see your own guess; you only see the opponent's
-- guess once the round has closed (both sides have played), matching the
-- "Der Tipp des Gegners bleibt bis zur Auflösung verdeckt" rule.
drop policy if exists "own or revealed duel guesses are readable" on public.duel_guesses;
create policy "own or revealed duel guesses are readable" on public.duel_guesses
  for select to authenticated using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.duel_rounds r
      join public.duels d on d.id = r.duel_id
      where r.id = duel_guesses.round_id
        and auth.uid() in (d.a_id, d.b_id)
        and r.closed_at is not null
    )
  );

-- friendships: only rows you're part of; writes via redeem_invite RPC.
drop policy if exists "own friendships are readable" on public.friendships;
create policy "own friendships are readable" on public.friendships
  for select to authenticated using (auth.uid() in (a_id, b_id));

-- league_seasons / standings: leaderboard data, readable by any signed-in
-- user. (MVP simplification — not scoped to "my group only" at the RLS
-- layer; app/src/lib/db.ts's getMyLeague() does that filtering client-side
-- with a couple of plain SELECTs instead of a dedicated RPC.)
drop policy if exists "league seasons are readable" on public.league_seasons;
create policy "league seasons are readable" on public.league_seasons
  for select to authenticated using (true);

drop policy if exists "standings are readable" on public.standings;
create policy "standings are readable" on public.standings
  for select to authenticated using (true);

-- devices: manage your own push-token registrations only.
drop policy if exists "own devices are readable" on public.devices;
create policy "own devices are readable" on public.devices
  for select to authenticated using (profile_id = auth.uid());
drop policy if exists "own devices are writable" on public.devices;
create policy "own devices are writable" on public.devices
  for insert to authenticated with check (profile_id = auth.uid());
drop policy if exists "own devices are updatable" on public.devices;
create policy "own devices are updatable" on public.devices
  for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
drop policy if exists "own devices are removable" on public.devices;
create policy "own devices are removable" on public.devices
  for delete to authenticated using (profile_id = auth.uid());

-- notifications: read/mark-read your own; insert only via send_push() RPC.
drop policy if exists "own notifications are readable" on public.notifications;
create policy "own notifications are readable" on public.notifications
  for select to authenticated using (profile_id = auth.uid());
drop policy if exists "own notifications are markable read" on public.notifications;
create policy "own notifications are markable read" on public.notifications
  for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- question_reports: no client-facing policies at all — always written via
-- the report_question() security-definer RPC, never read back by clients.
