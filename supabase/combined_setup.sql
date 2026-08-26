-- Schätzduell — combined setup (migrations + seed), generated for one-paste use in the Supabase SQL Editor.
-- Individual files in migrations/ and seed/ are the source of truth; this is just their concatenation in order.
-- Safe to re-run from the top if it fails partway through.

-- ===== migrations/0001_extensions_and_enums.sql =====
-- Schätzduell — extensions and enum types.
-- Run migrations in this directory in filename order (SQL editor or `supabase db push`).

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_cron;    -- rotate_week() / close_league_season() schedules

do $$ begin
  create type duel_status as enum ('active', 'finished');
exception when duplicate_object then null; end $$;

do $$ begin
  create type friendship_status as enum ('pending', 'accepted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type league_tier as enum ('bronze', 'silver', 'gold', 'diamond', 'platin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type device_platform as enum ('ios', 'android', 'web');
exception when duplicate_object then null; end $$;

-- ===== migrations/0002_tables.sql =====
-- Schätzduell — core schema.

create table if not exists public.categories (
  id smallint primary key,
  name text not null,
  description text not null
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null unique,
  is_guest boolean not null default false,
  xp int not null default 0,
  level int not null default 1,
  streak int not null default 0,
  push_opt_in boolean not null default true,
  invite_code text not null unique,
  imported_local_save boolean not null default false,
  last_completed_week text,
  created_at timestamptz not null default now()
);

-- Columns safe to expose about *other* users (duel opponents, friends, standings).
-- Deliberately NOT security_invoker: this view runs as its owner (which owns
-- and can read the whole profiles table) so it can return other people's
-- rows despite the base table's "own row only" RLS policy — but it only
-- ever selects the safe column list below, so nothing private leaks.
--
-- Drop-and-recreate rather than `create or replace`: a later migration
-- (0010_avatar.sql) appends a column to this view, and Postgres refuses
-- `create or replace view` if it would ever *remove* a column — which is
-- exactly what re-running the full migration set from the top would do on a
-- database that already has 0010 applied. Drop+create has no such
-- restriction, and any grants lost with the drop are re-issued right after
-- in 0003_auth_trigger_and_privileges.sql regardless.
drop view if exists public.profile_public;
create view public.profile_public as
  select id, name, xp, level, streak, created_at
  from public.profiles;

create table if not exists public.questions (
  id serial primary key,
  cat_id smallint not null references public.categories (id),
  text text not null unique,
  answer numeric not null,
  unit text not null,
  volatile boolean not null default false,
  source_url text,
  checked_at date
);

create table if not exists public.question_reports (
  id bigint generated always as identity primary key,
  question_id int not null references public.questions (id),
  reason text not null,
  reported_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table if not exists public.weeks (
  iso_week text primary key, -- e.g. '2026-W35'
  question_ids int[] not null,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  seed int not null
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  question_id int not null references public.questions (id),
  week text references public.weeks (iso_week),
  guess numeric not null,
  score int not null,
  idem_key text not null,
  created_at timestamptz not null default now(),
  unique (profile_id, idem_key),
  unique (profile_id, question_id, week)
);

create table if not exists public.duels (
  id uuid primary key default gen_random_uuid(),
  a_id uuid not null references public.profiles (id) on delete cascade,
  b_id uuid not null references public.profiles (id) on delete cascade,
  rounds int not null default 6,
  status duel_status not null default 'active',
  turn_of uuid not null references public.profiles (id),
  rematch_of uuid references public.duels (id),
  created_at timestamptz not null default now(),
  check (a_id <> b_id)
);

create table if not exists public.duel_rounds (
  id uuid primary key default gen_random_uuid(),
  duel_id uuid not null references public.duels (id) on delete cascade,
  n int not null,
  question_id int not null references public.questions (id),
  closed_at timestamptz,
  unique (duel_id, n)
);

create table if not exists public.duel_guesses (
  round_id uuid not null references public.duel_rounds (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  guess numeric not null,
  score int not null,
  idem_key text not null,
  created_at timestamptz not null default now(),
  primary key (round_id, profile_id),
  unique (profile_id, idem_key)
);

create table if not exists public.friendships (
  a_id uuid not null references public.profiles (id) on delete cascade,
  b_id uuid not null references public.profiles (id) on delete cascade,
  status friendship_status not null default 'accepted',
  accepted_at timestamptz not null default now(),
  primary key (a_id, b_id),
  check (a_id <> b_id)
);

create table if not exists public.league_seasons (
  id uuid primary key default gen_random_uuid(),
  tier league_tier not null,
  group_no int not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null
);

create table if not exists public.standings (
  season_id uuid not null references public.league_seasons (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  points int not null default 0,
  primary key (season_id, profile_id)
);

create table if not exists public.badges (
  key text primary key,
  title text not null,
  rule jsonb not null
);

create table if not exists public.profile_badges (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  badge_key text not null references public.badges (key) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (profile_id, badge_key)
);

-- In-app notifications — the real, working half of "push". A client that is
-- open subscribes to this table over Realtime and renders the push-style
-- banner from the design. Actual OS-level push (APNs/FCM) additionally needs
-- a native shell with device tokens and is out of scope here; see
-- ARCHITECTURE.md and send_push() in 0005_functions.sql.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  platform device_platform not null,
  push_token text not null,
  last_seen_at timestamptz not null default now(),
  unique (profile_id, push_token)
);

-- Auto-generate a short, unique friend-invite code per profile.
create or replace function public.generate_invite_code() returns text
language plpgsql as $$
declare
  candidate text;
  tries int := 0;
begin
  loop
    candidate := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));
    exit when not exists (select 1 from public.profiles where invite_code = candidate);
    tries := tries + 1;
    if tries > 20 then
      raise exception 'could not generate a unique invite code';
    end if;
  end loop;
  return candidate;
end;
$$;

create or replace function public.set_invite_code() returns trigger
language plpgsql as $$
begin
  if new.invite_code is null then
    new.invite_code := public.generate_invite_code();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_invite_code on public.profiles;
create trigger trg_set_invite_code
  before insert on public.profiles
  for each row execute function public.set_invite_code();

-- ===== migrations/0003_auth_trigger_and_privileges.sql =====
-- Schätzduell — new-user provisioning and column-level privilege lockdown.

-- Every auth.users row gets a matching profiles row automatically, whether it
-- came from email+password signup, magic link, OAuth, or anonymous guest sign-in.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base_name text;
  final_name text;
  suffix int := 0;
begin
  base_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    'Spieler' || substr(new.id::text, 1, 4)
  );
  final_name := base_name;
  loop
    exit when not exists (select 1 from public.profiles where name = final_name);
    suffix := suffix + 1;
    final_name := base_name || suffix;
  end loop;

  insert into public.profiles (id, name, is_guest)
  values (new.id, final_name, coalesce(new.is_anonymous, false));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The answer column must never leave Postgres before a guess is scored.
-- RPCs below are security definer (owned by the migration role) and read the
-- full row internally; direct client selects only ever see the safe columns.
revoke select on public.questions from authenticated, anon;
grant select (id, cat_id, text, unit, volatile, source_url, checked_at)
  on public.questions to authenticated, anon;

create index if not exists idx_attempts_profile on public.attempts (profile_id);
create index if not exists idx_attempts_week on public.attempts (week);
create index if not exists idx_duel_rounds_duel on public.duel_rounds (duel_id);
create index if not exists idx_duels_a on public.duels (a_id);
create index if not exists idx_duels_b on public.duels (b_id);
create index if not exists idx_friendships_b on public.friendships (b_id);
create index if not exists idx_standings_season on public.standings (season_id, points desc);
create index if not exists idx_devices_profile on public.devices (profile_id);
create index if not exists idx_questions_cat on public.questions (cat_id);
create index if not exists idx_notifications_profile on public.notifications (profile_id, created_at desc);

-- Explicit grants rather than relying on a project's ambient default
-- privileges (Supabase sets sensible defaults for new tables, but this makes
-- the intent explicit and portable to a vanilla Postgres instance too).
-- RLS policies (0004) still gate rows on every real table; this view has no
-- RLS of its own by design — see the comment on its definition in 0002.
grant select on public.profile_public to authenticated;
grant select on public.categories, public.badges, public.weeks, public.league_seasons, public.standings,
  public.profile_badges, public.attempts, public.duels, public.duel_rounds, public.duel_guesses,
  public.friendships, public.devices, public.notifications
  to authenticated;
grant select, update (name, push_opt_in) on public.profiles to authenticated;
grant select, insert, update, delete on public.devices to authenticated;
grant select, update (read_at) on public.notifications to authenticated;
-- Function EXECUTE grants are handled in 0006_privilege_lockdown.sql, run
-- after every RPC in 0005_functions.sql exists — see the comment there for
-- why this can't just be "grant execute on all functions to authenticated".

-- ===== migrations/0004_rls_policies.sql =====
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

-- ===== migrations/0005_functions.sql =====
-- Schätzduell — RPCs. All security definer, all `set search_path = public`
-- (required so a security-definer function can't be tricked by a caller's
-- search_path). These are the only way any of the gameplay tables get
-- written to — see the comment at the top of 0004_rls_policies.sql.

-- ─────────────────────────────────────────────────────────────
-- Scoring — ported 1:1 from the existing client build's score()/accuracy().
-- ─────────────────────────────────────────────────────────────
create or replace function public.score_guess(g numeric, a numeric) returns int
language plpgsql immutable as $$
declare
  p numeric;
  r numeric;
begin
  if g is null or a is null then return 0; end if;
  if a > 0 and g > 0 then
    r := greatest(g / a, a / g);
    p := 100 * (1 - log(r) / 1.3); -- log(numeric) is base-10 in Postgres
  else
    p := 100 * (1 - abs(g - a) / greatest(abs(a), 1));
  end if;
  p := greatest(0, least(100, p));
  return round(p);
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- League enrollment — every profile always belongs to exactly one open
-- (bronze-tier, if new) group of up to 30. Called from handle_new_user()
-- and lazily from get_week()/other reads if somehow missing a season.
-- ─────────────────────────────────────────────────────────────
create or replace function public.ensure_enrolled(p_profile uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  szn record;
  sid uuid;
begin
  select s.season_id into sid
    from public.standings s
    join public.league_seasons ls on ls.id = s.season_id
    where s.profile_id = p_profile and ls.ends_at > now()
    limit 1;
  if sid is not null then return sid; end if;

  select ls.* into szn from public.league_seasons ls
    where ls.tier = 'bronze' and ls.ends_at > now()
      and (select count(*) from public.standings st where st.season_id = ls.id) < 30
    order by ls.starts_at desc
    limit 1;

  if szn is null then
    insert into public.league_seasons (tier, group_no, starts_at, ends_at)
    values (
      'bronze',
      (select coalesce(max(group_no), 0) + 1 from public.league_seasons where tier = 'bronze'),
      date_trunc('week', now()),
      date_trunc('week', now()) + interval '7 days'
    )
    returning * into szn;
  end if;

  insert into public.standings (season_id, profile_id, points) values (szn.id, p_profile, 0);
  return szn.id;
end;
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base_name text;
  final_name text;
  suffix int := 0;
begin
  base_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    'Spieler' || substr(new.id::text, 1, 4)
  );
  final_name := base_name;
  loop
    exit when not exists (select 1 from public.profiles where name = final_name);
    suffix := suffix + 1;
    final_name := base_name || suffix;
  end loop;

  insert into public.profiles (id, name, is_guest)
  values (new.id, final_name, coalesce(new.is_anonymous, false));

  perform public.ensure_enrolled(new.id);
  return new;
end;
$$;
-- (recreated here from 0003 now that ensure_enrolled exists — trigger already
-- points at this function name, no need to redo the CREATE TRIGGER.)

create or replace function public.recompute_level() returns trigger
language plpgsql as $$
begin
  new.level := greatest(1, floor(new.xp / 300) + 1);
  return new;
end;
$$;

drop trigger if exists trg_recompute_level on public.profiles;
create trigger trg_recompute_level
  before insert or update of xp on public.profiles
  for each row execute function public.recompute_level();

-- ─────────────────────────────────────────────────────────────
-- Weekly challenge
-- ─────────────────────────────────────────────────────────────
create or replace function public.get_week() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  w public.weeks%rowtype;
  result jsonb;
begin
  if me is null then raise exception 'not authenticated'; end if;

  select * into w from public.weeks
    where opens_at <= now() and closes_at > now()
    order by opens_at desc limit 1;

  if not found then
    raise exception 'no active week — an operator needs to run rotate_week()';
  end if;

  select jsonb_build_object(
    'iso_week', w.iso_week,
    'opens_at', w.opens_at,
    'closes_at', w.closes_at,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id,
        'cat_id', q.cat_id,
        'cat_name', c.name,
        'text', q.text,
        'unit', q.unit,
        'volatile', q.volatile,
        'position', ord.pos,
        'answered', a.id is not null,
        'score', a.score
      ) order by ord.pos)
      from unnest(w.question_ids) with ordinality as ord(qid, pos)
      join public.questions q on q.id = ord.qid
      join public.categories c on c.id = q.cat_id
      left join public.attempts a on a.question_id = q.id and a.profile_id = me and a.week = w.iso_week
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

create or replace function public.submit_attempt(p_question_id int, p_guess numeric, p_idem_key text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  w public.weeks%rowtype;
  truth numeric;
  s int;
  existing public.attempts%rowtype;
  pct int;
  cnt int;
  at_or_better int;
begin
  if me is null then raise exception 'not authenticated'; end if;

  select * into existing from public.attempts where profile_id = me and idem_key = p_idem_key;
  if found then
    select answer into truth from public.questions where id = existing.question_id;
    return jsonb_build_object('score', existing.score, 'truth', truth, 'idempotent', true);
  end if;

  select * into w from public.weeks
    where opens_at <= now() and closes_at > now()
    order by opens_at desc limit 1;
  if not found or not (p_question_id = any(w.question_ids)) then
    raise exception 'question % is not part of the active week', p_question_id;
  end if;

  select answer into truth from public.questions where id = p_question_id;
  s := public.score_guess(p_guess, truth);

  begin
    insert into public.attempts (profile_id, question_id, week, guess, score, idem_key)
    values (me, p_question_id, w.iso_week, p_guess, s, p_idem_key);
  exception when unique_violation then
    select * into existing from public.attempts
      where profile_id = me and question_id = p_question_id and week = w.iso_week;
    return jsonb_build_object('score', existing.score, 'truth', truth, 'idempotent', true);
  end;

  update public.profiles set xp = xp + s where id = me;

  if s >= 95 then perform public.award_badge(me, 'volltreffer'); end if;
  if extract(hour from now() at time zone 'Europe/Berlin') < 5 then
    perform public.award_badge(me, 'nachteule');
  end if;

  select count(*), count(*) filter (where score <= s)
    into cnt, at_or_better
    from public.attempts where question_id = p_question_id and week = w.iso_week;
  pct := case when cnt > 0 then round(100.0 * at_or_better / cnt) else 100 end;

  return jsonb_build_object('score', s, 'truth', truth, 'percentile', pct);
end;
$$;

drop trigger if exists trg_advance_streak on public.attempts;
create or replace function public.maybe_advance_streak() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  w public.weeks%rowtype;
  answered_count int;
  total_count int;
  prev_iso text;
  contiguous boolean;
begin
  select * into w from public.weeks where iso_week = new.week;
  if not found then return new; end if;
  total_count := array_length(w.question_ids, 1);

  select count(*) into answered_count from public.attempts
    where profile_id = new.profile_id and week = new.week;

  if answered_count >= total_count then
    select last_completed_week into prev_iso from public.profiles where id = new.profile_id;

    if prev_iso is not distinct from new.week then
      -- already counted this week's completion (e.g. a report/reattempt path)
      return new;
    end if;

    contiguous := false;
    if prev_iso is not null then
      select exists(
        select 1 from public.weeks pw where pw.iso_week = prev_iso and pw.closes_at = w.opens_at
      ) into contiguous;
    end if;

    update public.profiles
      set streak = case when contiguous then streak + 1 else 1 end,
          last_completed_week = new.week
      where id = new.profile_id;

    perform public.award_badge(new.profile_id, 'alle_kat'); -- a week spans all 5 categories
    if (select streak from public.profiles where id = new.profile_id) >= 7 then
      perform public.award_badge(new.profile_id, 'serie7');
    end if;
    if (select streak from public.profiles where id = new.profile_id) >= 20 then
      perform public.award_badge(new.profile_id, 'serie20');
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_advance_streak
  after insert on public.attempts
  for each row execute function public.maybe_advance_streak();

-- ─────────────────────────────────────────────────────────────
-- Practice mode — stateless, doesn't touch attempts/xp/streak/league.
-- ─────────────────────────────────────────────────────────────
create or replace function public.practice_questions(p_cat_ids smallint[], p_count int default 20)
returns jsonb
language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id, 'cat_id', q.cat_id, 'cat_name', c.name,
    'text', q.text, 'unit', q.unit, 'volatile', q.volatile
  )), '[]'::jsonb)
  from (
    select * from public.questions
    where cat_id = any(p_cat_ids)
    order by random()
    limit greatest(1, least(p_count, 100))
  ) q
  join public.categories c on c.id = q.cat_id;
$$;

create or replace function public.practice_guess(p_question_id int, p_guess numeric)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  truth numeric;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select answer into truth from public.questions where id = p_question_id;
  if not found then raise exception 'unknown question %', p_question_id; end if;
  return jsonb_build_object('score', public.score_guess(p_guess, truth), 'truth', truth);
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Duels — asynchronous, N rounds, either side plays whenever they like.
-- ─────────────────────────────────────────────────────────────
create or replace function public.create_duel(p_opponent_id uuid, p_rounds int default 6, p_rematch_of uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  d_id uuid;
  qids int[];
begin
  if me is null then raise exception 'not authenticated'; end if;
  if me = p_opponent_id then raise exception 'cannot duel yourself'; end if;

  if not exists (
    select 1 from public.friendships
    where (a_id, b_id) = (least(me, p_opponent_id), greatest(me, p_opponent_id))
  ) then
    raise exception 'can only duel a friend — redeem an invite code first';
  end if;

  -- avoid questions either player has already seen recently (weekly attempts
  -- or prior duel rounds against anyone), fall back to fully random if the
  -- pool of "fresh" questions is too small.
  select array_agg(id) into qids from (
    select id from public.questions
    where id not in (
      select question_id from public.attempts where profile_id in (me, p_opponent_id)
      union
      select dr.question_id from public.duel_rounds dr
        join public.duels d on d.id = dr.duel_id
        where me in (d.a_id, d.b_id) or p_opponent_id in (d.a_id, d.b_id)
    )
    order by random()
    limit greatest(1, least(p_rounds, 20))
  ) fresh;

  if qids is null or array_length(qids, 1) < p_rounds then
    select array_agg(id) into qids from (
      select id from public.questions order by random() limit greatest(1, least(p_rounds, 20))
    ) any_q;
  end if;

  insert into public.duels (a_id, b_id, rounds, turn_of, rematch_of)
  values (me, p_opponent_id, p_rounds, p_opponent_id, p_rematch_of)
  returning id into d_id;

  insert into public.duel_rounds (duel_id, n, question_id)
  select d_id, gen.n, qids[gen.n]
  from generate_series(1, p_rounds) as gen(n);

  perform public.send_push(
    p_opponent_id, 'Schätzduell', (select name from public.profiles where id = me) || ' fordert dich heraus.'
  );

  return d_id;
end;
$$;

create or replace function public.get_duel(p_duel_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  d public.duels%rowtype;
  result jsonb;
begin
  select * into d from public.duels where id = p_duel_id;
  if not found or me not in (d.a_id, d.b_id) then
    raise exception 'duel not found';
  end if;

  select jsonb_build_object(
    'id', d.id, 'status', d.status, 'rounds', d.rounds,
    'me', me, 'opponent', case when d.a_id = me then d.b_id else d.a_id end,
    'opponent_name', (select name from public.profiles where id = case when d.a_id = me then d.b_id else d.a_id end),
    'round_list', coalesce((
      select jsonb_agg(jsonb_build_object(
        'round_id', r.id, 'n', r.n, 'closed', r.closed_at is not null,
        'cat_name', c.name, 'text', q.text, 'unit', q.unit,
        'my_guess', mg.guess, 'my_score', mg.score,
        'opp_guess', case when r.closed_at is not null then og.guess end,
        'opp_score', case when r.closed_at is not null then og.score end,
        'truth', case when r.closed_at is not null then q.answer end
      ) order by r.n)
      from public.duel_rounds r
      join public.questions q on q.id = r.question_id
      join public.categories c on c.id = q.cat_id
      left join public.duel_guesses mg on mg.round_id = r.id and mg.profile_id = me
      left join public.duel_guesses og on og.round_id = r.id and og.profile_id <> me
      where r.duel_id = d.id
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

create or replace function public.submit_duel_guess(p_round_id uuid, p_guess numeric, p_idem_key text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r public.duel_rounds%rowtype;
  d public.duels%rowtype;
  truth numeric;
  s int;
  existing public.duel_guesses%rowtype;
  opp_row public.duel_guesses%rowtype;
  opponent uuid;
  closed boolean := false;
begin
  if me is null then raise exception 'not authenticated'; end if;

  select * into r from public.duel_rounds where id = p_round_id;
  if not found then raise exception 'round not found'; end if;
  select * into d from public.duels where id = r.duel_id;
  if me not in (d.a_id, d.b_id) then raise exception 'not your duel'; end if;
  opponent := case when d.a_id = me then d.b_id else d.a_id end;

  select * into existing from public.duel_guesses where profile_id = me and idem_key = p_idem_key;
  if found then
    select answer into truth from public.questions where id = r.question_id;
    return jsonb_build_object('score', existing.score, 'truth', truth, 'idempotent', true);
  end if;

  select answer into truth from public.questions where id = r.question_id;
  s := public.score_guess(p_guess, truth);

  begin
    insert into public.duel_guesses (round_id, profile_id, guess, score, idem_key)
    values (p_round_id, me, p_guess, s, p_idem_key);
  exception when unique_violation then
    select * into existing from public.duel_guesses where round_id = p_round_id and profile_id = me;
    return jsonb_build_object('score', existing.score, 'truth', truth, 'idempotent', true);
  end;

  select * into opp_row from public.duel_guesses where round_id = p_round_id and profile_id = opponent;
  if found then
    update public.duel_rounds set closed_at = now() where id = p_round_id;
    closed := true;

    if not exists (select 1 from public.duel_rounds where duel_id = d.id and closed_at is null) then
      update public.duels set status = 'finished' where id = d.id;
      perform public.finish_duel_bonus(d.id);
    else
      perform public.send_push(
        opponent, 'Schätzduell', (select name from public.profiles where id = me) || ' hat seinen Zug gemacht.'
      );
    end if;
  end if;

  return jsonb_build_object(
    'score', s,
    'closed', closed,
    'opp_score', case when closed then opp_row.score end,
    'opp_guess', case when closed then opp_row.guess end,
    'truth', truth
  );
end;
$$;

create or replace function public.finish_duel_bonus(p_duel_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  d public.duels%rowtype;
  my_total int; opp_total int;
begin
  select * into d from public.duels where id = p_duel_id;

  select coalesce(sum(score), 0) into my_total from public.duel_guesses g
    join public.duel_rounds r on r.id = g.round_id where r.duel_id = p_duel_id and g.profile_id = d.a_id;
  select coalesce(sum(score), 0) into opp_total from public.duel_guesses g
    join public.duel_rounds r on r.id = g.round_id where r.duel_id = p_duel_id and g.profile_id = d.b_id;

  update public.profiles set xp = xp + 20 where id in (d.a_id, d.b_id); -- participation XP
  if my_total > opp_total then
    update public.profiles set xp = xp + 15 where id = d.a_id;
    perform public.award_badge(d.a_id, 'duellsieg');
  elsif opp_total > my_total then
    update public.profiles set xp = xp + 15 where id = d.b_id;
    perform public.award_badge(d.b_id, 'duellsieg');
  end if;
end;
$$;

create or replace function public.award_badge(p_profile uuid, p_badge_key text) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profile_badges (profile_id, badge_key)
  values (p_profile, p_badge_key)
  on conflict do nothing;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Friends
-- ─────────────────────────────────────────────────────────────
create or replace function public.redeem_invite(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  target public.profiles%rowtype;
  -- upper() first: the prefix-strip regex is case-sensitive, so stripping
  -- before upper() would miss a lowercase "sd-" prefix.
  clean_code text := regexp_replace(upper(trim(p_code)), '^SD-?', '');
begin
  if me is null then raise exception 'not authenticated'; end if;

  select * into target from public.profiles where invite_code = clean_code;
  if not found then raise exception 'unknown invite code'; end if;
  if target.id = me then raise exception 'cannot friend yourself'; end if;

  insert into public.friendships (a_id, b_id)
  values (least(me, target.id), greatest(me, target.id))
  on conflict do nothing;

  return jsonb_build_object('friend_id', target.id, 'friend_name', target.name);
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Local-save migration (from the pre-account browser build)
-- ─────────────────────────────────────────────────────────────
create or replace function public.import_local_save(p_payload jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  already boolean;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select imported_local_save into already from public.profiles where id = me;
  if already then return; end if;

  update public.profiles set
    xp = greatest(xp, coalesce((p_payload ->> 'xp')::int, 0)),
    streak = greatest(streak, coalesce((p_payload ->> 'streak')::int, 0)),
    imported_local_save = true
  where id = me;

  -- Note: the old build's per-question "already played" history
  -- (playedQuestionIds) intentionally isn't replayed into `attempts` here —
  -- those rows carry no week reference and re-synthesizing one would be
  -- guesswork. Streak and XP are what actually matter to the player and are
  -- carried over; this is a documented MVP simplification, not a bug.
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Question quality reports
-- ─────────────────────────────────────────────────────────────
create or replace function public.report_question(p_question_id int, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.question_reports (question_id, reason, reported_by)
  values (p_question_id, left(coalesce(p_reason, ''), 500), auth.uid());
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Account lifecycle (DSGVO: export + delete)
-- ─────────────────────────────────────────────────────────────
create or replace function public.export_my_data() returns jsonb
language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'attempts', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from public.attempts a where a.profile_id = auth.uid()),
    'duels', (select coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) from public.duels d where auth.uid() in (d.a_id, d.b_id)),
    'friendships', (select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb) from public.friendships f where auth.uid() in (f.a_id, f.b_id))
  );
$$;

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from auth.users where id = auth.uid(); -- cascades to public.profiles and everything hanging off it
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Push — real in-app delivery over Realtime; APNs/FCM is a documented
-- follow-up (see ARCHITECTURE.md) once there's a native Capacitor shell.
-- ─────────────────────────────────────────────────────────────
create or replace function public.send_push(p_profile_id uuid, p_title text, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare
  opted_in boolean;
begin
  select push_opt_in into opted_in from public.profiles where id = p_profile_id;
  if coalesce(opted_in, true) then
    insert into public.notifications (profile_id, title, body) values (p_profile_id, p_title, p_body);
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Cron jobs
-- ─────────────────────────────────────────────────────────────
create or replace function public.rotate_week() returns void
language plpgsql security definer set search_path = public as $$
declare
  cur_monday date := (date_trunc('week', now() at time zone 'Europe/Berlin'))::date;
  iso text := to_char(cur_monday, 'IYYY') || '-W' || to_char(cur_monday, 'IW');
  opens timestamptz := cur_monday::timestamp at time zone 'Europe/Berlin';
  closes timestamptz := (cur_monday + 7)::timestamp at time zone 'Europe/Berlin';
  wk_no int := to_char(cur_monday, 'IW')::int;
  qids int[] := '{}';
  cat_q int[];
  c smallint;
begin
  if exists (select 1 from public.weeks where iso_week = iso) then return; end if;

  for c in 0..4 loop
    select array_agg(id order by id) into cat_q from public.questions where cat_id = c;
    -- Deterministic pick from the calendar week, not from randomness (same
    -- idea as Wordle): cycles through a category's 75 questions before any
    -- repeat, comfortably clearing the "53 weeks without a dupe" target.
    qids := qids || cat_q[1 + (wk_no % array_length(cat_q, 1))];
  end loop;

  insert into public.weeks (iso_week, question_ids, opens_at, closes_at, seed)
  values (iso, qids, opens, closes, wk_no);
end;
$$;

-- Runs hourly but is a no-op unless a season has actually ended; closing on
-- an hourly tick (rather than only exactly at the 7-day mark) means a missed
-- or delayed cron run still settles promptly instead of drifting further.
create or replace function public.close_league_season() returns void
language plpgsql security definer set search_path = public as $$
declare
  tiers league_tier[] := array['bronze', 'silver', 'gold', 'diamond', 'platin'];
  szn record;
  cnt int;
  tier_idx int;
  new_starts timestamptz := date_trunc('week', now());
  new_ends timestamptz := date_trunc('week', now()) + interval '7 days';
  t league_tier;
  members uuid[];
  gid uuid;
  i int;
begin
  if not exists (select 1 from public.league_seasons where ends_at <= now()) then
    return;
  end if;

  create temporary table if not exists _next_tier (profile_id uuid, tier league_tier) on commit drop;
  delete from _next_tier;

  for szn in select * from public.league_seasons where ends_at <= now() loop
    select count(*) into cnt from public.standings where season_id = szn.id;
    tier_idx := array_position(tiers, szn.tier);

    insert into _next_tier (profile_id, tier)
    select ranked.profile_id,
      case
        when ranked.rnk <= 5 and tier_idx < array_length(tiers, 1) then tiers[tier_idx + 1]
        when ranked.rnk > cnt - 5 and cnt > 5 and tier_idx > 1 then tiers[tier_idx - 1]
        else szn.tier
      end
    from (
      select profile_id, row_number() over (order by points desc) as rnk
      from public.standings where season_id = szn.id
    ) ranked;
  end loop;

  insert into public.profile_badges (profile_id, badge_key)
  select nt.profile_id, 'aufstieg'
  from _next_tier nt
  join public.standings s on s.profile_id = nt.profile_id
  join public.league_seasons ls on ls.id = s.season_id and ls.ends_at <= now()
  where array_position(tiers, nt.tier) > array_position(tiers, ls.tier)
  on conflict do nothing;

  insert into public.profile_badges (profile_id, badge_key)
  select profile_id, 'gold' from _next_tier where tier = 'gold'
  on conflict do nothing;
  insert into public.profile_badges (profile_id, badge_key)
  select profile_id, 'diamant' from _next_tier where tier in ('diamond', 'platin')
  on conflict do nothing;

  -- batch everyone landing in the same tier into fresh groups of up to 30
  foreach t in array tiers loop
    select array_agg(profile_id order by random()) into members from _next_tier where tier = t;
    if members is null then continue; end if;

    i := 1;
    while i <= array_length(members, 1) loop
      insert into public.league_seasons (tier, group_no, starts_at, ends_at)
      values (t, (select coalesce(max(group_no), 0) + 1 from public.league_seasons where tier = t), new_starts, new_ends)
      returning id into gid;

      insert into public.standings (season_id, profile_id, points)
      select gid, m from unnest(members[i : least(i + 29, array_length(members, 1))]) as m;

      i := i + 30;
    end loop;
  end loop;
end;
$$;

create or replace function public.refresh_standings() returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.standings s set points = coalesce((
    select sum(a.score) from public.attempts a
    join public.league_seasons ls on ls.id = s.season_id
    where a.profile_id = s.profile_id
      and a.created_at >= ls.starts_at and a.created_at < ls.ends_at
  ), 0) + coalesce((
    select sum(dg.score) from public.duel_guesses dg
    join public.duel_rounds dr on dr.id = dg.round_id
    join public.league_seasons ls on ls.id = s.season_id
    where dg.profile_id = s.profile_id
      and dg.created_at >= ls.starts_at and dg.created_at < ls.ends_at
  ), 0)
  from public.league_seasons ls
  where ls.id = s.season_id and ls.ends_at > now();
end;
$$;

-- cron.schedule() upserts by job name in modern pg_cron, so re-running this
-- migration is safe. If `create extension pg_cron` in 0001 failed with a
-- permissions error, enable it first via Dashboard → Database → Extensions,
-- then re-run this file.
select cron.schedule('rotate_week_monday', '0 0 * * 1', $$select public.rotate_week()$$);
select cron.schedule('close_league_season_hourly', '0 * * * *', $$select public.close_league_season()$$);
select cron.schedule('refresh_standings_5min', '*/5 * * * *', $$select public.refresh_standings()$$);

-- ===== migrations/0006_privilege_lockdown.sql =====
-- Schätzduell — function-level privilege lockdown.
--
-- Postgres grants EXECUTE on a new function to PUBLIC by default. Left alone,
-- that means Supabase's auto-exposed /rpc/<fn> endpoint would let ANY signed
-- in client call things like award_badge(profile_id, badge_key) directly —
-- self-awarding arbitrary badges — or replay finish_duel_bonus(duel_id) to
-- farm XP repeatedly. Those are internal helpers other RPCs call via
-- `perform`, never something a client should invoke on its own. Same for the
-- three cron jobs: nothing stops a client from calling rotate_week() early
-- or hammering refresh_standings() if we don't lock them down here.
--
-- Trigger functions (handle_new_user, recompute_level, maybe_advance_streak,
-- set_invite_code) aren't included below — Postgres already refuses to call
-- a function returning `trigger` outside of trigger context, so there's
-- nothing to revoke there.

-- send_push(profile_id, title, body) is in this list too: left at its
-- Postgres default it would let any signed-in client spam a notification row
-- into ANY other profile's inbox (it takes an arbitrary target id, not "me").
-- Real pushes only ever originate from create_duel()/submit_duel_guess()
-- calling it internally, which still works after this revoke — the object
-- owner (and a security-definer call already running as that owner) is
-- exempt from privilege checks on objects it owns.
revoke execute on function
  public.ensure_enrolled(uuid),
  public.generate_invite_code(),
  public.finish_duel_bonus(uuid),
  public.award_badge(uuid, text),
  public.send_push(uuid, text, text),
  public.rotate_week(),
  public.close_league_season(),
  public.refresh_standings()
from public, anon, authenticated;

-- Everything else in this migration set is meant to be called by a signed-in
-- client and is left at its Postgres default (EXECUTE granted to PUBLIC) —
-- each one individually checks auth.uid() and re-validates its inputs
-- server-side, so that default is intentional, not an oversight.

-- ===== migrations/0007_realtime.sql =====
-- Enable Realtime (Postgres logical replication) for the tables the client
-- subscribes to: in-app notifications (PushBanner.tsx) and live duel-round
-- updates (DuelDetail screen). Realtime respects each table's RLS policies
-- from 0004, so a client only ever receives change events for rows they
-- could already SELECT directly.
--
-- `alter publication ... add table` errors if the table is already a member,
-- so this is wrapped to make re-running the file safe. If it errors with
-- "publication supabase_realtime does not exist", your project uses a
-- different publication name — check Database → Replication in the
-- Supabase dashboard and adjust, or just toggle Realtime on for these three
-- tables there instead of running this file.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'duel_rounds'
  ) then
    alter publication supabase_realtime add table public.duel_rounds;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'duel_guesses'
  ) then
    alter publication supabase_realtime add table public.duel_guesses;
  end if;
end $$;

-- ===== migrations/0008_friend_requests.sql =====
-- Schätzduell — friend requests.
--
-- Originally, the only way to become friends was exchanging an invite code
-- (implicit mutual consent — sharing the code IS the invite). Random
-- matchmaking (0009_matchmaking.sql) needs a second path: "we just played a
-- stranger, let me send them a friend request" — which needs actual
-- request/accept semantics, not instant friendship. `friendships.status`
-- already had a `pending` value in its enum for exactly this, unused until
-- now; this migration adds who-requested-whom so the UI can tell "you have
-- an incoming request" from "you're waiting on someone".

alter table public.friendships add column if not exists requested_by uuid references public.profiles (id);

-- Backfill: any friendship that predates this column (made via redeem_invite,
-- always mutual-consent-by-code) is attributed to whichever side happens to
-- be `a_id` — arbitrary but harmless, since those rows are already
-- `status = 'accepted'` and requested_by has no effect once accepted.
update public.friendships set requested_by = a_id where requested_by is null;

alter table public.friendships alter column requested_by set not null;

create or replace function public.redeem_invite(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  target public.profiles%rowtype;
  -- upper() first: the prefix-strip regex is case-sensitive, so stripping
  -- before upper() would miss a lowercase "sd-" prefix.
  clean_code text := regexp_replace(upper(trim(p_code)), '^SD-?', '');
begin
  if me is null then raise exception 'not authenticated'; end if;

  select * into target from public.profiles where invite_code = clean_code;
  if not found then raise exception 'unknown invite code'; end if;
  if target.id = me then raise exception 'cannot friend yourself'; end if;

  -- Entering someone's code is already mutual consent (they shared it with
  -- you on purpose), so this goes straight to accepted — no request phase.
  insert into public.friendships (a_id, b_id, status, requested_by)
  values (least(me, target.id), greatest(me, target.id), 'accepted', me)
  on conflict (a_id, b_id) do update set status = 'accepted'
  where public.friendships.status = 'pending';

  return jsonb_build_object('friend_id', target.id, 'friend_name', target.name);
end;
$$;

-- Send a friend request to someone you're not already friends with (e.g. a
-- matchmaking opponent). No-op if a friendship (pending or accepted)
-- already exists in either direction.
create or replace function public.send_friend_request(p_target_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  target_name text;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if me = p_target_id then raise exception 'cannot friend yourself'; end if;

  select name into target_name from public.profiles where id = p_target_id;
  if not found then raise exception 'unknown profile'; end if;

  insert into public.friendships (a_id, b_id, status, requested_by)
  values (least(me, p_target_id), greatest(me, p_target_id), 'pending', me)
  on conflict (a_id, b_id) do nothing;

  return jsonb_build_object('target_name', target_name);
end;
$$;

-- Accept or decline a request that was sent TO you (never one you sent).
create or replace function public.respond_friend_request(p_target_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  a uuid := least(me, p_target_id);
  b uuid := greatest(me, p_target_id);
begin
  if me is null then raise exception 'not authenticated'; end if;

  if not exists (
    select 1 from public.friendships
    where a_id = a and b_id = b and status = 'pending' and requested_by = p_target_id
  ) then
    raise exception 'no pending request from that profile';
  end if;

  if p_accept then
    update public.friendships set status = 'accepted' where a_id = a and b_id = b;
  else
    delete from public.friendships where a_id = a and b_id = b;
  end if;
end;
$$;

-- ===== migrations/0009_matchmaking.sql =====
-- Schätzduell — random-opponent matchmaking (Quizduell-style "Zufallsgegner"),
-- on top of the existing friend-challenge duels.

create table if not exists public.matchmaking_queue (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  rounds int not null default 6,
  joined_at timestamptz not null default now()
);

alter table public.matchmaking_queue enable row level security;
-- No client-facing policies at all, same as question_reports: the queue is
-- only ever touched from inside find_or_create_match()/cancel_matchmaking(),
-- both security definer. There's nothing in this table a client needs to
-- read directly — "am I matched yet" is answered by find_or_create_match()
-- returning a duel id (or null) each time the client polls it.

-- The row-creating half of create_duel(), pulled out so both the
-- friend-challenge path and the matchmaking path share one implementation
-- instead of two copies of the "pick fresh questions, insert duel + rounds,
-- notify" logic.
create or replace function public.create_duel_rows(p_a uuid, p_b uuid, p_rounds int, p_rematch_of uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  d_id uuid;
  qids int[];
begin
  select array_agg(id) into qids from (
    select id from public.questions
    where id not in (
      select question_id from public.attempts where profile_id in (p_a, p_b)
      union
      select dr.question_id from public.duel_rounds dr
        join public.duels d on d.id = dr.duel_id
        where p_a in (d.a_id, d.b_id) or p_b in (d.a_id, d.b_id)
    )
    order by random()
    limit greatest(1, least(p_rounds, 20))
  ) fresh;

  if qids is null or array_length(qids, 1) < p_rounds then
    select array_agg(id) into qids from (
      select id from public.questions order by random() limit greatest(1, least(p_rounds, 20))
    ) any_q;
  end if;

  insert into public.duels (a_id, b_id, rounds, turn_of, rematch_of)
  values (p_a, p_b, p_rounds, p_b, p_rematch_of)
  returning id into d_id;

  insert into public.duel_rounds (duel_id, n, question_id)
  select d_id, gen.n, qids[gen.n]
  from generate_series(1, p_rounds) as gen(n);

  perform public.send_push(
    p_b, 'Schätzduell', (select name from public.profiles where id = p_a) || ' fordert dich heraus.'
  );

  return d_id;
end;
$$;

-- create_duel(): still requires being friends OR that this is a rematch of a
-- duel the two of you already played (covers "rematch a matchmaking
-- stranger" without requiring a friend request first) — "challenge this
-- arbitrary profile id" from a screen that only ever offers real friends or
-- real past opponents stays the only two ways in.
create or replace function public.create_duel(p_opponent_id uuid, p_rounds int default 6, p_rematch_of uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  already_played boolean := false;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if me = p_opponent_id then raise exception 'cannot duel yourself'; end if;

  if p_rematch_of is not null then
    select exists (
      select 1 from public.duels
      where id = p_rematch_of and (a_id, b_id) = (least(me, p_opponent_id), greatest(me, p_opponent_id))
    ) into already_played;
  end if;

  if not already_played and not exists (
    select 1 from public.friendships
    where (a_id, b_id) = (least(me, p_opponent_id), greatest(me, p_opponent_id))
      and status = 'accepted'
  ) then
    raise exception 'can only duel a friend — redeem an invite code first';
  end if;

  return public.create_duel_rows(me, p_opponent_id, p_rounds, p_rematch_of);
end;
$$;

-- find_or_create_match(): the "Zufallsgegner" path — no friendship required.
-- Call it, and either get back a duel id (you were matched immediately) or
-- null (you're now waiting in the queue — call again in a couple of seconds
-- to keep checking; whichever side calls next completes the match for both).
create or replace function public.find_or_create_match(p_rounds int default 6) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  candidate uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;

  select profile_id into candidate
    from public.matchmaking_queue
    where profile_id <> me and rounds = p_rounds
    order by joined_at
    limit 1
    for update skip locked;

  if candidate is not null then
    delete from public.matchmaking_queue where profile_id in (me, candidate);
    return public.create_duel_rows(me, candidate, p_rounds, null);
  end if;

  insert into public.matchmaking_queue (profile_id, rounds, joined_at)
  values (me, p_rounds, now())
  on conflict (profile_id) do update set rounds = excluded.rounds, joined_at = now();

  return null;
end;
$$;

create or replace function public.cancel_matchmaking() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.matchmaking_queue where profile_id = auth.uid();
end;
$$;

-- Same reasoning as 0006_privilege_lockdown.sql: create_duel_rows() is an
-- internal helper (it trusts its p_a/p_b arguments completely, with none of
-- create_duel()'s or find_or_create_match()'s own checks) — never something
-- a client should call directly with an arbitrary pair of profile ids.
revoke execute on function public.create_duel_rows(uuid, uuid, int, uuid) from public, anon, authenticated;

-- ===== migrations/0010_avatar.sql =====
-- Schätzduell — customizable avatar (background color, skin tone, hair color
-- and style). Stored as jsonb rather than separate columns since it's
-- purely cosmetic, client-rendered, and the shape may grow (more hairstyles,
-- accessories) without needing another migration each time.

alter table public.profiles add column if not exists avatar jsonb not null default '{}'::jsonb;

-- Recreate profile_public so avatars show up for opponents/friends/standings
-- too, not just your own profile — same non-security_invoker view as
-- before (see 0002_tables.sql), just with one more safe column.
create or replace view public.profile_public as
  select id, name, xp, level, streak, created_at, avatar
  from public.profiles;

grant select on public.profile_public to authenticated;

-- Cosmetic only, no gameplay effect — safe to let the client write directly
-- rather than routing through an RPC.
grant update (avatar) on public.profiles to authenticated;

-- get_duel() also needs to hand back the opponent's avatar (their name was
-- already inlined here rather than going through profile_public, so their
-- avatar has to be added the same way).
create or replace function public.get_duel(p_duel_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  d public.duels%rowtype;
  result jsonb;
begin
  select * into d from public.duels where id = p_duel_id;
  if not found or me not in (d.a_id, d.b_id) then
    raise exception 'duel not found';
  end if;

  select jsonb_build_object(
    'id', d.id, 'status', d.status, 'rounds', d.rounds,
    'me', me, 'opponent', case when d.a_id = me then d.b_id else d.a_id end,
    'opponent_name', (select name from public.profiles where id = case when d.a_id = me then d.b_id else d.a_id end),
    'opponent_avatar', (select avatar from public.profiles where id = case when d.a_id = me then d.b_id else d.a_id end),
    'round_list', coalesce((
      select jsonb_agg(jsonb_build_object(
        'round_id', r.id, 'n', r.n, 'closed', r.closed_at is not null,
        'cat_name', c.name, 'text', q.text, 'unit', q.unit,
        'my_guess', mg.guess, 'my_score', mg.score,
        'opp_guess', case when r.closed_at is not null then og.guess end,
        'opp_score', case when r.closed_at is not null then og.score end,
        'truth', case when r.closed_at is not null then q.answer end
      ) order by r.n)
      from public.duel_rounds r
      join public.questions q on q.id = r.question_id
      join public.categories c on c.id = q.cat_id
      left join public.duel_guesses mg on mg.round_id = r.id and mg.profile_id = me
      left join public.duel_guesses og on og.round_id = r.id and og.profile_id <> me
      where r.duel_id = d.id
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

-- ===== seed/001_categories.sql =====
insert into public.categories (id, name, description) values
  (0, 'Körper & Sport', 'Puls, Kalorien, Rekorde, Stadien'),
  (1, 'Welt & Natur', 'Tiere, Ozeane, Wetter, Weltall'),
  (2, 'Alltag & Zahlen', 'Essen, Wohnen, Gewohnheiten'),
  (3, 'Geld & Business', 'Preise, Gehälter, Konzerne'),
  (4, 'Tech & Kultur', 'Internet, Games, Film, Musik')
on conflict (id) do update set name = excluded.name, description = excluded.description;

-- ===== seed/002_questions.sql =====
-- Auto-generated from schaetzduell-verbessert.html — 375 questions, 5 categories.
-- Regenerate with app/../scripts if the source question set changes.
insert into public.questions (cat_id, text, answer, unit, volatile) values
  (0, 'Wie oft schlägt ein Herz an einem Tag?', 100000, 'Schläge', false),
  (0, 'Wie viele Liter Blut pumpt das Herz pro Tag durch den Körper?', 7000, 'Liter', false),
  (0, 'Wie viele Kilometer Blutgefäße stecken in einem Menschen?', 100000, 'km', false),
  (0, 'Wie viele Liter Luft atmet ein Mensch pro Tag ein?', 11000, 'Liter', false),
  (0, 'Wie oft blinzelt ein Mensch an einem Tag?', 15000, 'mal', false),
  (0, 'Wie viele Kilometer läuft ein Bundesliga-Spieler pro Spiel?', 11, 'km', false),
  (0, 'Wie viele Kalorien verbrennt man bei einem Marathon?', 2700, 'kcal', false),
  (0, 'Wie viele Liter Schweiß verliert man bei einem Marathon?', 3, 'Liter', false),
  (0, 'Wie viel wiegt ein menschliches Gehirn?', 1400, 'Gramm', false),
  (0, 'Wie viele Jahre seines Lebens verschläft ein 80-Jähriger?', 26, 'Jahre', false),
  (0, 'Wie viele Kalorien stecken in einem Kilo Körperfett?', 7000, 'kcal', false),
  (0, 'Wie viele Schritte macht ein Deutscher im Schnitt pro Tag?', 5200, 'Schritte', false),
  (0, 'Wie viele Millimeter wachsen Haare pro Monat?', 12, 'Millimeter', false),
  (0, 'Wie viel Prozent des männlichen Körpers ist Wasser?', 60, 'Prozent', false),
  (0, 'Wie schnell war der schnellste je gemessene Tennis-Aufschlag?', 263, 'km/h', false),
  (0, 'Wie schnell lief Usain Bolt bei seinem 100-m-Weltrekord im Schnitt?', 37.6, 'km/h', false),
  (0, 'Wie viele Sekunden brauchte Usain Bolt für seinen 100-m-Weltrekord?', 9.58, 'Sekunden', false),
  (0, 'Wie hoch ist der Hochsprung-Weltrekord der Männer?', 245, 'Zentimeter', false),
  (0, 'Wie weit ist der Weitsprung-Weltrekord der Männer?', 895, 'Zentimeter', false),
  (0, 'Wie viele Liegestütze schafft der Weltrekordhalter in einer Stunde?', 2900, 'Liegestütze', false),
  (0, 'Wie viele Tore fallen im Schnitt pro Bundesliga-Spiel?', 3.1, 'Tore', false),
  (0, 'Wie viele Zuschauer passen ins Stadion des 1. FC Köln?', 50000, 'Zuschauer', false),
  (0, 'Wie viele Zuschauer passen ins Camp Nou in Barcelona?', 99000, 'Zuschauer', false),
  (0, 'Wie viele Menschen weltweit spielen aktiv Fußball?', 250000000, 'Menschen', false),
  (0, 'Wie viel wiegt eine olympische Langhantelstange?', 20, 'Kilogramm', false),
  (0, 'Wie viele Wochen braucht ein gebrochener Knochen zum Heilen?', 6, 'Wochen', false),
  (0, 'Wie viele Kilometer rennt ein Tennisprofi in einem Fünfsatz-Match?', 5, 'km', false),
  (0, 'Wie viele Knochen hat ein erwachsener Mensch?', 206, 'Knochen', false),
  (0, 'Wie lang ist der Dünndarm eines Erwachsenen?', 6, 'Meter', false),
  (0, 'Wie viele Nervenzellen hat das menschliche Gehirn?', 86000000000, 'Nervenzellen', false),
  (0, 'Wie viele Liter Speichel produziert ein Mensch pro Tag?', 1.5, 'Liter', false),
  (0, 'Wie viele Geschmacksknospen hat ein Mensch?', 10000, 'Knospen', false),
  (0, 'Wie viele Schweißdrüsen hat ein Mensch?', 3000000, 'Drüsen', false),
  (0, 'Wie viele Kilogramm Nahrung isst ein Mensch pro Jahr?', 500, 'Kilogramm', false),
  (0, 'Wie viele Tonnen Nahrung isst ein Mensch in seinem ganzen Leben?', 30, 'Tonnen', false),
  (0, 'Wie schnell strömt die Luft beim Niesen aus der Nase?', 160, 'km/h', false),
  (0, 'Wie viel Prozent des Sauerstoffs verbraucht allein das Gehirn?', 20, 'Prozent', false),
  (0, 'Wie viele Kalorien verbraucht das Gehirn pro Tag?', 400, 'kcal', false),
  (0, 'Wie viele Stunden braucht Essen, um den Magen zu verlassen?', 4, 'Stunden', false),
  (0, 'Wie viele Liter Urin produziert ein Mensch pro Jahr?', 550, 'Liter', false),
  (0, 'Wie viele Kilometer legt ein Handballer pro Spiel zurück?', 5, 'km', false),
  (0, 'Wie viele Kilometer fährt das Feld bei der Tour de France insgesamt?', 3400, 'km', false),
  (0, 'Wie viele Höhenmeter sammelt die Tour de France insgesamt?', 50000, 'Höhenmeter', false),
  (0, 'Wie viele Kalorien verbraucht ein Tour-de-France-Fahrer pro Tag?', 6000, 'kcal', false),
  (0, 'Wie schnell fliegt ein Ball bei einem Elfmeter?', 110, 'km/h', false),
  (0, 'Wie viele Minuten ist der Ball in einem Fußballspiel effektiv im Spiel?', 55, 'Minuten', false),
  (0, 'Wie viele Pässe spielt ein Team im Schnitt pro Bundesliga-Spiel?', 450, 'Pässe', false),
  (0, 'Wie viele Fouls gibt es im Schnitt pro Bundesliga-Spiel?', 25, 'Fouls', false),
  (0, 'Wie viele Kilometer läuft ein Schiedsrichter pro Spiel?', 11, 'km', false),
  (0, 'Wie viel wiegt ein Fußball?', 430, 'Gramm', false),
  (0, 'Wie hoch ist ein Fußballtor?', 2.44, 'Meter', false),
  (0, 'Wie breit ist ein Fußballtor?', 7.32, 'Meter', false),
  (0, 'Wie viele Grübchen hat ein Golfball?', 336, 'Grübchen', false),
  (0, 'Wie schnell ist ein Badminton-Schmetterball maximal?', 493, 'km/h', false),
  (0, 'Wie viele Kalorien hat ein Liter Bier?', 430, 'kcal', false),
  (0, 'Wie hoch ist der Grundumsatz eines erwachsenen Mannes pro Tag?', 1700, 'kcal', false),
  (0, 'Wie lange hält der Weltrekordhalter die Luft an?', 24, 'Minuten', false),
  (0, 'Wie tief geht der Freitauch-Weltrekord?', 214, 'Meter', false),
  (0, 'Wie alt wurde der älteste Mensch der Welt?', 122, 'Jahre', false),
  (0, 'Wie groß war der größte Mensch der Welt?', 272, 'Zentimeter', false),
  (0, 'Wie viel wiegt ein Neugeborenes im Schnitt?', 3400, 'Gramm', false),
  (0, 'Wie viele Knochen hat ein Neugeborenes?', 300, 'Knochen', false),
  (0, 'Wie viele Billionen Zellen hat der menschliche Körper?', 37, 'Billionen', false),
  (0, 'Wie viele Millionen rote Blutkörperchen bildet der Körper pro Sekunde?', 2.4, 'Millionen', false),
  (0, 'Wie hoch springt ein NBA-Spieler im Schnitt aus dem Stand?', 71, 'Zentimeter', false),
  (0, 'Wie viele Punkte erzielt ein NBA-Team im Schnitt pro Spiel?', 115, 'Punkte', false),
  (0, 'Wie viele Kilometer legt ein NBA-Spieler pro Spiel zurück?', 4, 'km', false),
  (0, 'Wie viele Sekunden dauert der 400-Meter-Weltrekord der Männer?', 43.03, 'Sekunden', false),
  (0, 'Wie viele Minuten braucht der Marathon-Weltrekordhalter?', 120, 'Minuten', false),
  (0, 'Wie viele Kilometer läuft der 24-Stunden-Weltrekordhalter?', 319, 'km', false),
  (0, 'Wie viel Prozent Körperfett hat ein Profifußballer?', 10, 'Prozent', false),
  (0, 'Wie viele Kalorien verbrennt eine Stunde Fußball?', 700, 'kcal', false),
  (0, 'Wie viel Gramm Protein stecken in einem Ei?', 7, 'Gramm', false),
  (0, 'Wie hoch hängt ein Volleyballnetz bei den Männern?', 243, 'Zentimeter', false),
  (0, 'Wie viele Bänder stabilisieren ein Kniegelenk?', 4, 'Bänder', false),
  (1, 'Wie viele Milliarden Bäume stehen auf der Erde?', 3000, 'Milliarden', true),
  (1, 'Wie viele Blitze schlagen weltweit pro Sekunde ein?', 100, 'Blitze', false),
  (1, 'Wie tief ist die tiefste Stelle im Marianengraben?', 10994, 'Meter', false),
  (1, 'Wie viel wiegt eine mittelgroße Schönwetterwolke?', 500, 'Tonnen', false),
  (1, 'Wie viele Inseln gehören zu Indonesien?', 17500, 'Inseln', false),
  (1, 'Wie alt kann ein Mammutbaum werden?', 3000, 'Jahre', false),
  (1, 'Wie hoch ist der höchste Baum der Welt?', 116, 'Meter', false),
  (1, 'Wie viele Kilometer fliegt eine Küstenseeschwalbe pro Jahr?', 70000, 'km', false),
  (1, 'Wie viele Eier legt eine Bienenkönigin an einem Tag?', 2000, 'Eier', false),
  (1, 'Wie viele Bienen leben im Sommer in einem Bienenstock?', 50000, 'Bienen', false),
  (1, 'Wie viele Kilometer fliegen Bienen zusammen für ein Kilo Honig?', 120000, 'km', false),
  (1, 'Wie oft schlägt das Herz einer Maus pro Minute?', 600, 'mal', false),
  (1, 'Wie viele Zähne hat ein Weißer Hai gleichzeitig im Maul?', 300, 'Zähne', false),
  (1, 'Wie lange kann ein Pottwal die Luft anhalten?', 90, 'Minuten', false),
  (1, 'Wie tief taucht ein Pottwal?', 2000, 'Meter', false),
  (1, 'Wie viel wiegt ein Straußenei?', 1400, 'Gramm', false),
  (1, 'Wie viele Insektenarten sind bisher bekannt?', 1000000, 'Arten', false),
  (1, 'Wie viel Prozent aller bekannten Tierarten sind Insekten?', 80, 'Prozent', false),
  (1, 'Wie viele Liter Wasser trinkt ein Kamel auf einmal?', 100, 'Liter', false),
  (1, 'Wie oft schlägt ein Kolibri pro Sekunde mit den Flügeln?', 50, 'mal', false),
  (1, 'Wie viele Liter Milch gibt eine Kuh pro Tag?', 25, 'Liter', false),
  (1, 'Wie schwer war der schwerste je gezüchtete Kürbis?', 1200, 'Kilogramm', false),
  (1, 'Wie hoch fliegt ein Passagierflugzeug auf Reiseflughöhe?', 11000, 'Meter', false),
  (1, 'Wie viele aktive Vulkane gibt es weltweit?', 1500, 'Vulkane', false),
  (1, 'Wie lange braucht Sonnenlicht bis zur Erde?', 8, 'Minuten', false),
  (1, 'Wie lange ist eine Elefantenkuh trächtig?', 22, 'Monate', false),
  (1, 'Wie schwer ist ein ausgewachsener Blauwal?', 150, 'Tonnen', false),
  (1, 'Wie lang ist die Chinesische Mauer insgesamt?', 21196, 'km', false),
  (1, 'Wie tief ist der Ozean im weltweiten Durchschnitt?', 3700, 'Meter', false),
  (1, 'Wie viel Prozent des Amazonas-Regenwaldes sind schon gerodet?', 17, 'Prozent', false),
  (1, 'Wie viele Liter Wasser stürzen pro Sekunde die Niagarafälle hinab?', 2400, 'Liter', false),
  (1, 'Wie hoch ist der höchste Wasserfall der Welt?', 979, 'Meter', false),
  (1, 'Wie lang ist der Erdumfang am Äquator?', 40075, 'km', false),
  (1, 'Wie viele Millionen Kilometer ist die Sonne von der Erde entfernt?', 150, 'Millionen km', false),
  (1, 'Wie heiß ist die Oberfläche der Sonne?', 5500, 'Grad Celsius', false),
  (1, 'Wie viele Milliarden Sterne hat die Milchstraße?', 200, 'Milliarden', true),
  (1, 'Wie schnell dreht sich die Erde am Äquator?', 1670, 'km/h', false),
  (1, 'Wie viele Kilometer pro Sekunde fliegt die Erde um die Sonne?', 30, 'km/s', false),
  (1, 'Wie schnell war der stärkste je gemessene Windstoß?', 408, 'km/h', false),
  (1, 'Wie viele Millimeter Regen fallen pro Jahr in Deutschland?', 790, 'Millimeter', false),
  (1, 'Wie kalt war die kälteste je gemessene Temperatur der Erde?', -89, 'Grad Celsius', false),
  (1, 'Wie heiß war die heißeste je gemessene Temperatur der Erde?', 56.7, 'Grad Celsius', false),
  (1, 'Wie hoch war die höchste je gemessene Welle?', 30, 'Meter', false),
  (1, 'Wie viel Salz steckt in einem Liter Meerwasser?', 35, 'Gramm', false),
  (1, 'Wie viele Millionen Tonnen Plastik landen pro Jahr im Meer?', 8, 'Mio. Tonnen', false),
  (1, 'Wie viele Vogelarten gibt es weltweit?', 11000, 'Arten', false),
  (1, 'Wie viele Fischarten sind bekannt?', 35000, 'Arten', false),
  (1, 'Wie viele Spinnenarten gibt es?', 50000, 'Arten', false),
  (1, 'Wie viele Ameisen leben in einem großen Ameisenhaufen?', 1000000, 'Ameisen', false),
  (1, 'Wie viele Stunden schläft eine Giraffe pro Tag?', 2, 'Stunden', false),
  (1, 'Wie viele Stunden schläft ein Koala pro Tag?', 20, 'Stunden', false),
  (1, 'Wie viele Tage kommt ein Kamel ohne Wasser aus?', 14, 'Tage', false),
  (1, 'Wie schnell schwimmt ein Schwertfisch?', 100, 'km/h', false),
  (1, 'Wie schnell ist ein Wanderfalke im Sturzflug?', 320, 'km/h', false),
  (1, 'Wie viele Millionen Geruchszellen hat eine Hundenase?', 220, 'Millionen', false),
  (1, 'Wie alt wird ein Grönlandhai?', 400, 'Jahre', false),
  (1, 'Wie viel wiegt das Herz eines Blauwals?', 180, 'Kilogramm', false),
  (1, 'Wie viele Stacheln hat ein Igel?', 8000, 'Stacheln', false),
  (1, 'Wie viele Muskeln stecken in einem Elefantenrüssel?', 40000, 'Muskeln', false),
  (1, 'Wie viele Kilogramm frisst ein Elefant pro Tag?', 150, 'Kilogramm', false),
  (1, 'Wie viele Liter Wasser trinkt ein Elefant pro Tag?', 150, 'Liter', false),
  (1, 'Wie viele Kilogramm Sauerstoff produziert ein Baum pro Jahr?', 100, 'Kilogramm', false),
  (1, 'Wie weit ist der Mond von der Erde entfernt?', 384400, 'km', false),
  (1, 'Wie viele Monde hat der Jupiter?', 95, 'Monde', false),
  (1, 'Wie viele Erdtage dauert ein Tag auf der Venus?', 243, 'Erdtage', false),
  (1, 'Wie kalt ist es im freien Weltall?', -270, 'Grad Celsius', false),
  (1, 'Wie groß ist der Durchmesser der Sonne?', 1392000, 'km', false),
  (1, 'Wie viele Erden würden in die Sonne passen?', 1300000, 'Erden', false),
  (1, 'Wie viele Tonnen Meteoritenmaterial treffen pro Tag auf die Erde?', 100, 'Tonnen', false),
  (1, 'Wie heiß ist der Erdkern?', 5200, 'Grad Celsius', false),
  (1, 'Wie viele Erdbeben werden weltweit pro Jahr registriert?', 500000, 'Erdbeben', false),
  (1, 'Wie viele Baumarten gibt es weltweit?', 73000, 'Arten', false),
  (1, 'Wie viel Prozent des Sauerstoffs produzieren die Meere?', 50, 'Prozent', false),
  (1, 'Wie viele Zentimeter wächst Bambus an einem Tag?', 90, 'Zentimeter', false),
  (1, 'Wie viele Jahre braucht eine Plastikflasche zum Zerfallen?', 450, 'Jahre', false),
  (2, 'Wie viele Reiskörner sind in einem Kilo Reis?', 50000, 'Körner', false),
  (2, 'Wie viele Kaffeebohnen braucht man für einen Espresso?', 50, 'Bohnen', false),
  (2, 'Wie viele Liter Kaffee trinkt ein Deutscher pro Jahr?', 165, 'Liter', false),
  (2, 'Wie viele Liter Bier trinkt ein Deutscher pro Jahr?', 88, 'Liter', false),
  (2, 'Wie viele Eier isst ein Deutscher pro Jahr?', 240, 'Eier', false),
  (2, 'Wie viel Fleisch isst ein Deutscher pro Jahr?', 52, 'Kilogramm', false),
  (2, 'Wie viele Kilometer fährt ein deutsches Auto pro Jahr?', 13000, 'km', false),
  (2, 'Wie viele Autos sind in Deutschland zugelassen?', 49000000, 'Autos', false),
  (2, 'Wie oft entsperrt ein Mensch sein Handy an einem Tag?', 80, 'mal', false),
  (2, 'Wie viele Minuten am Tag ist ein Deutscher am Smartphone?', 150, 'Minuten', false),
  (2, 'Wie viele Wörter spricht ein Mensch an einem Tag?', 16000, 'Wörter', false),
  (2, 'Wie viele Wörter hat ein durchschnittlicher Roman?', 80000, 'Wörter', false),
  (2, 'Wie viele Träume hat ein Mensch pro Nacht?', 5, 'Träume', false),
  (2, 'Wie oft lacht ein Kind an einem Tag?', 300, 'mal', false),
  (2, 'Wie viele Liter Wasser verbraucht eine 10-Minuten-Dusche?', 120, 'Liter', false),
  (2, 'Wie viele Liter Wasser verbraucht ein Deutscher pro Tag zu Hause?', 125, 'Liter', false),
  (2, 'Wie viele Liter Wasser stecken in einem Kilo Rindfleisch?', 15000, 'Liter', false),
  (2, 'Wie viele Liter Wasser stecken hinter einer einzigen Tasse Kaffee?', 130, 'Liter', false),
  (2, 'Wie viele Einzelteile hat ein modernes Auto?', 30000, 'Teile', false),
  (2, 'Wie viele Stufen führen im Eiffelturm bis zur Spitze?', 1665, 'Stufen', false),
  (2, 'Wie viele Stufen sind es im Kölner Dom bis zur Aussichtsplattform?', 533, 'Stufen', false),
  (2, 'Wie viele Fenster hat das Empire State Building?', 6500, 'Fenster', false),
  (2, 'Wie viele Kilometer Strich schreibt ein einzelner Bleistift?', 56, 'km', false),
  (2, 'Wie viele Legosteine werden pro Sekunde produziert?', 1100, 'Steine', false),
  (2, 'Wie oft müsste man ein Blatt Papier falten, bis es den Mond erreicht?', 42, 'mal', false),
  (2, 'Wie viele Liter passen in eine normale Badewanne?', 150, 'Liter', false),
  (2, 'Wie viele Blätter hat eine Rolle Toilettenpapier?', 200, 'Blätter', false),
  (2, 'Wie viele Milliarden Zigaretten werden in Deutschland pro Jahr geraucht?', 65, 'Milliarden', true),
  (2, 'Wie viele Minuten schaut ein Deutscher pro Tag fern?', 190, 'Minuten', false),
  (2, 'Wie viele Menschen leben in der Metropolregion Tokio?', 37000000, 'Menschen', false),
  (2, 'Wie viele Zahnbürsten verbraucht ein Mensch in seinem Leben?', 300, 'Zahnbürsten', false),
  (2, 'Wie viele Tage seines Lebens putzt ein Mensch Zähne?', 38, 'Tage', false),
  (2, 'Wie viele Mahlzeiten isst ein Mensch in seinem Leben?', 80000, 'Mahlzeiten', false),
  (2, 'Wie viele Pizzen isst ein Deutscher pro Jahr?', 12, 'Pizzen', false),
  (2, 'Wie viele Kilo Kartoffeln isst ein Deutscher pro Jahr?', 60, 'Kilogramm', false),
  (2, 'Wie viele Kilo Schokolade isst ein Deutscher pro Jahr?', 9, 'Kilogramm', false),
  (2, 'Wie viele Kilo Zucker isst ein Deutscher pro Jahr?', 33, 'Kilogramm', false),
  (2, 'Wie viele Kilo Brot isst ein Deutscher pro Jahr?', 42, 'Kilogramm', false),
  (2, 'Wie viele Liter Milch trinkt ein Deutscher pro Jahr?', 48, 'Liter', false),
  (2, 'Wie viele Liter Mineralwasser trinkt ein Deutscher pro Jahr?', 130, 'Liter', false),
  (2, 'Wie viele Bäume braucht man für eine Tonne Papier?', 14, 'Bäume', false),
  (2, 'Wie viele Kilo Papier verbraucht ein Deutscher pro Jahr?', 220, 'Kilogramm', false),
  (2, 'Wie viele Kilo Müll produziert ein Deutscher pro Jahr?', 480, 'Kilogramm', false),
  (2, 'Wie viele Kilo Verpackungsmüll produziert ein Deutscher pro Jahr?', 230, 'Kilogramm', false),
  (2, 'Wie viele Kleidungsstücke kauft ein Deutscher pro Jahr?', 60, 'Teile', false),
  (2, 'Wie viele Kleidungsstücke hängen in einem deutschen Kleiderschrank?', 95, 'Teile', false),
  (2, 'Wie viele Stunden arbeitet ein Deutscher im Schnitt pro Woche?', 35, 'Stunden', false),
  (2, 'Wie viele Krankheitstage hat ein Deutscher pro Jahr?', 15, 'Tage', false),
  (2, 'Wie viele Minuten pendelt ein Deutscher pro Tag?', 45, 'Minuten', false),
  (2, 'Wie viele Kilometer pendelt ein Deutscher pro Weg zur Arbeit?', 17, 'km', false),
  (2, 'Wie viele Fahrgäste befördert die Kölner KVB pro Tag?', 800000, 'Fahrgäste', false),
  (2, 'Wie viele Kilometer Schienennetz hat die Deutsche Bahn?', 33000, 'km', false),
  (2, 'Wie viele Kilometer Autobahn gibt es in Deutschland?', 13200, 'km', false),
  (2, 'Wie viele Brücken gibt es an deutschen Autobahnen und Bundesstraßen?', 40000, 'Brücken', false),
  (2, 'Wie viele Ampeln gibt es in Deutschland?', 100000, 'Ampeln', false),
  (2, 'Wie viele Bäckereibetriebe gibt es in Deutschland?', 9600, 'Betriebe', false),
  (2, 'Wie viele Apotheken gibt es in Deutschland?', 17000, 'Apotheken', false),
  (2, 'Wie viele Katzen leben in deutschen Haushalten?', 15700000, 'Katzen', false),
  (2, 'Wie viele Hunde leben in deutschen Haushalten?', 10500000, 'Hunde', false),
  (2, 'Wie viele Kinder werden pro Jahr in Deutschland geboren?', 690000, 'Kinder', false),
  (2, 'Wie viele Menschen werden weltweit pro Tag geboren?', 380000, 'Menschen', false),
  (2, 'Wie viele Menschen sitzen gerade gleichzeitig in einem Flugzeug?', 1000000, 'Menschen', false),
  (2, 'Wie viele Menschen leben in Köln?', 1090000, 'Menschen', false),
  (2, 'Wie viele Millionen Besucher hat der Kölner Dom pro Jahr?', 6, 'Millionen', false),
  (2, 'Wie viele Teilnehmer laufen im Kölner Rosenmontagszug mit?', 12000, 'Teilnehmer', false),
  (2, 'Wie viele Wörter passen auf eine eng beschriebene A4-Seite?', 500, 'Wörter', false),
  (2, 'Wie viele Buchstaben hat das längste Wort im Duden?', 44, 'Buchstaben', false),
  (2, 'Wie viele Kilowattstunden Strom verbraucht ein Zweipersonenhaushalt pro Jahr?', 3000, 'Kilowattstunden', false),
  (2, 'Wie viele Cent kostet eine Kilowattstunde Strom in Deutschland?', 35, 'Cent', true),
  (2, 'Wie viele Liter verbraucht ein deutsches Auto auf 100 Kilometer?', 7, 'Liter', false),
  (2, 'Wie viele Sitzplätze hat ein ICE?', 460, 'Sitzplätze', false),
  (2, 'Wie viele Millionen Passagiere fliegen pro Jahr über Köln/Bonn?', 9, 'Millionen', false),
  (2, 'Wie viele Flugzeuge sind gerade gleichzeitig in der Luft?', 10000, 'Flugzeuge', false),
  (2, 'Wie viele Millionen Erwerbstätige gibt es in Deutschland?', 46, 'Millionen', false),
  (2, 'Wie viele Betriebe hat das deutsche Handwerk?', 1000000, 'Betriebe', false),
  (3, 'Wie viele Millionen Dollar kostet ein 30-Sekunden-Spot beim Super Bowl?', 7, 'Mio. Dollar', true),
  (3, 'Wie viel verdient ein Bundesliga-Profi im Schnitt pro Jahr?', 1500000, 'Euro', true),
  (3, 'Wie hoch ist der gesetzliche Mindestlohn in Deutschland 2026?', 13.9, 'Euro', true),
  (3, 'Wie hoch ist das durchschnittliche Bruttogehalt in Deutschland pro Monat?', 4300, 'Euro', true),
  (3, 'Wie viel kostet ein Big Mac in Deutschland?', 6, 'Euro', true),
  (3, 'Wie viele Millionen Dollar kostet ein neuer Airbus A320?', 110, 'Mio. Dollar', true),
  (3, 'Wie viel wiegt ein Standard-Goldbarren aus dem Tresor?', 12.4, 'Kilogramm', false),
  (3, 'Wie viele Menschen arbeiten weltweit für Amazon?', 1500000, 'Menschen', false),
  (3, 'Wie viele Pakete stellt DHL pro Tag in Deutschland zu?', 6000000, 'Pakete', false),
  (3, 'Wie viele Milliarden Dollar Umsatz macht Apple pro Jahr?', 390, 'Milliarden', true),
  (3, 'Wie viele Millionen Euro kostet ein Formel-1-Auto?', 15, 'Mio. Euro', true),
  (3, 'Wie viel kostet ein einzelnes Formel-1-Lenkrad?', 50000, 'Euro', true),
  (3, 'Wie viele Millionen Euro brachte der teuerste Fußball-Transfer ein?', 222, 'Mio. Euro', true),
  (3, 'Wie viel kostet ein Jahr Studium an einer US-Eliteuni?', 60000, 'Dollar', true),
  (3, 'Wie viele Millionäre leben in Deutschland?', 1600000, 'Millionäre', false),
  (3, 'Wie viele Millionen Euro kostet der Bau von einem Kilometer Autobahn?', 10, 'Mio. Euro', true),
  (3, 'Wie viele Millionen Euro kostet ein ICE-Zug?', 33, 'Mio. Euro', true),
  (3, 'Wie viele Millionen Dollar kostet eine Boeing 747?', 400, 'Mio. Dollar', true),
  (3, 'Wie hoch ist die Durchschnittsmiete pro Quadratmeter in Köln?', 14, 'Euro', true),
  (3, 'Wie viel kostet eine Kugel Eis in Deutschland im Schnitt?', 1.8, 'Euro', true),
  (3, 'Wie viel kostet ein Führerschein in Deutschland?', 3000, 'Euro', true),
  (3, 'Wie viel gibt ein Deutscher pro Jahr für Lebensmittel aus?', 3000, 'Euro', true),
  (3, 'Wie hoch ist die durchschnittliche Altersrente in Deutschland pro Monat?', 1100, 'Euro', true),
  (3, 'Wie viel wiegt eine Million Euro in 500-Euro-Scheinen?', 2.3, 'Kilogramm', true),
  (3, 'Wie viele Milliarden Euro-Banknoten sind im Umlauf?', 30, 'Milliarden', true),
  (3, 'Wie viel Prozent Trinkgeld sind in Deutschland üblich?', 10, 'Prozent', false),
  (3, 'Wie viele McDonald''s-Filialen gibt es weltweit?', 40000, 'Filialen', false),
  (3, 'Wie viele IKEA-Einrichtungshäuser gibt es weltweit?', 480, 'Häuser', false),
  (3, 'In welchem Jahr wurde IKEA gegründet?', 1943, 'Jahr', false),
  (3, 'Wie viel kostet ein Liter Super-Benzin in Deutschland?', 1.75, 'Euro', true),
  (3, 'Wie viel kostet ein Kilo Safran?', 5000, 'Euro', true),
  (3, 'Wie viel kostet ein Kilo weiße Trüffel?', 4000, 'Euro', true),
  (3, 'Wie viel kostet ein Kilo Kopi Luwak, der teuerste Kaffee der Welt?', 600, 'Euro', true),
  (3, 'Wie viel kostet ein durchschnittlicher Neuwagen in Deutschland?', 45000, 'Euro', true),
  (3, 'Wie viele Millionen Euro kostet ein Bugatti Chiron?', 3, 'Mio. Euro', true),
  (3, 'Wie viel kostet ein durchschnittliches Einfamilienhaus in Deutschland?', 400000, 'Euro', true),
  (3, 'Wie viel kostet ein Quadratmeter Bauland in Deutschland im Schnitt?', 200, 'Euro', true),
  (3, 'Wie viel kostet eine Hochzeit in Deutschland im Schnitt?', 15000, 'Euro', true),
  (3, 'Wie viel kostet ein Kind bis zum 18. Geburtstag?', 150000, 'Euro', true),
  (3, 'Wie viele Milliarden Euro Schulden hat der deutsche Staat?', 2500, 'Milliarden', true),
  (3, 'Wie viele Milliarden Euro umfasst der deutsche Bundeshaushalt pro Jahr?', 480, 'Milliarden', true),
  (3, 'Wie viele Milliarden Euro gibt Deutschland pro Jahr für Verteidigung aus?', 90, 'Milliarden', true),
  (3, 'Wie viele Milliarden Euro Umsatz macht Volkswagen pro Jahr?', 320, 'Milliarden', true),
  (3, 'Wie viele Menschen arbeiten weltweit für Volkswagen?', 680000, 'Menschen', false),
  (3, 'Wie viele Millionen Autos baut VW pro Jahr?', 9, 'Millionen', false),
  (3, 'Wie viele Milliarden Dollar Umsatz macht Nike pro Jahr?', 51, 'Milliarden', true),
  (3, 'Wie viel kostet ein Paar Nike-Sneaker in der Herstellung?', 20, 'Euro', true),
  (3, 'Wie viele Dollar kostet die Herstellung eines iPhones?', 550, 'Dollar', true),
  (3, 'Wie viele Millionen Euro zahlt ein Sponsor pro Jahr für ein Bundesliga-Trikot?', 30, 'Mio. Euro', true),
  (3, 'Wie viele Millionen Euro zahlen die TV-Sender pro Saison für die Bundesliga?', 1100, 'Mio. Euro', true),
  (3, 'Wie viele Millionen Euro Prämie gibt es für den Champions-League-Sieg?', 20, 'Mio. Euro', true),
  (3, 'Wie viel kostet eine Stehplatz-Dauerkarte beim 1. FC Köln?', 200, 'Euro', true),
  (3, 'Wie viel verdient ein Bundesliga-Schiedsrichter pro Spiel?', 5000, 'Euro', true),
  (3, 'Wie viel verdient ein Erzieher in Deutschland brutto pro Monat?', 3400, 'Euro', true),
  (3, 'Wie viel verdient ein Handwerksmeister brutto pro Monat?', 4200, 'Euro', true),
  (3, 'Wie viel verdient ein Lufthansa-Pilot pro Jahr?', 150000, 'Euro', true),
  (3, 'Wie hoch ist der durchschnittliche Stundenlohn in Deutschland?', 25, 'Euro', true),
  (3, 'Wie viel kostet eine Stunde beim Anwalt?', 250, 'Euro', true),
  (3, 'Wie viel kostet ein Tag im Krankenhaus?', 800, 'Euro', true),
  (3, 'Wie viel kostet eine Kinokarte in Deutschland im Schnitt?', 10, 'Euro', true),
  (3, 'Wie viele Milliarden Euro Umsatz macht die deutsche Gastronomie pro Jahr?', 95, 'Milliarden', true),
  (3, 'Wie viel kostet ein Kölsch in einer Kölner Kneipe?', 2.3, 'Euro', true),
  (3, 'Wie viel kostet ein 30-Sekunden-Werbespot zur Primetime im deutschen TV?', 50000, 'Euro', true),
  (3, 'Wie viel verdient ein Influencer mit 100.000 Followern pro Post?', 1000, 'Euro', true),
  (3, 'Wie viel verdient ein YouTuber pro 1.000 Videoaufrufe?', 2, 'Euro', true),
  (3, 'Wie viele Milliarden Dollar Umsatz macht die Games-Branche pro Jahr?', 190, 'Milliarden', true),
  (3, 'Wie viele Milliarden Dollar Umsatz macht Netflix pro Jahr?', 39, 'Milliarden', true),
  (3, 'Wie viele Millionen Abonnenten hat Netflix weltweit?', 300, 'Millionen', true),
  (3, 'Wie viel kostet ein Quadratmeter Eigentumswohnung in München?', 9000, 'Euro', true),
  (3, 'Wie viel kostet ein Quadratmeter Eigentumswohnung in Köln?', 5000, 'Euro', true),
  (3, 'Wie viel Geld hat ein Deutscher im Schnitt auf der hohen Kante?', 30000, 'Euro', true),
  (3, 'Wie viel Bargeld trägt ein Deutscher im Portemonnaie?', 100, 'Euro', true),
  (3, 'Wie viel Prozent aller Zahlungen in Deutschland laufen bar?', 50, 'Prozent', false),
  (3, 'Wie viele Filialen hat Aldi in Deutschland?', 4200, 'Filialen', false),
  (3, 'Wie viele Menschen arbeiten bei der Deutschen Bahn?', 330000, 'Menschen', false),
  (4, 'Wie viele Stunden Video werden pro Minute auf YouTube hochgeladen?', 500, 'Stunden', false),
  (4, 'Wie viele Google-Suchen laufen pro Sekunde?', 99000, 'Suchen', false),
  (4, 'Wie viele Milliarden E-Mails werden pro Tag verschickt?', 350, 'Milliarden', true),
  (4, 'Wie viele Millionen Songs liegen auf Spotify?', 100, 'Millionen', false),
  (4, 'Wie viele Milliarden Fotos werden pro Tag hochgeladen?', 5, 'Milliarden', true),
  (4, 'Wie viele Milliarden Transistoren hat ein moderner Smartphone-Chip?', 20, 'Milliarden', true),
  (4, 'Wie viele aktive Satelliten umkreisen die Erde?', 10000, 'Satelliten', false),
  (4, 'Wie schnell fliegt die ISS um die Erde?', 28000, 'km/h', false),
  (4, 'Wie oft umrundet die ISS die Erde an einem Tag?', 16, 'mal', false),
  (4, 'Wie viele Minuten braucht ein Funksignal mindestens bis zum Mars?', 4, 'Minuten', false),
  (4, 'Wie viele Zeichen darf ein klassischer Tweet maximal haben?', 280, 'Zeichen', false),
  (4, 'Wie viele Wörter hat der erste Harry-Potter-Band?', 77000, 'Wörter', false),
  (4, 'Wie viele offizielle Emojis gibt es?', 3800, 'Emojis', false),
  (4, 'Wie viele Filme produziert Bollywood pro Jahr?', 1500, 'Filme', false),
  (4, 'Wie viele Milliarden Dollar spielte Avatar weltweit ein?', 2.9, 'Milliarden', true),
  (4, 'Wie viele Millionen Dollar kostete die Produktion von GTA 5?', 265, 'Mio. Dollar', true),
  (4, 'Wie viele Millionen Exemplare von GTA 5 wurden verkauft?', 200, 'Millionen', false),
  (4, 'Wie viele Millionen Kopien von Minecraft wurden verkauft?', 300, 'Millionen', false),
  (4, 'Wie viele Milliarden Menschen spielen weltweit Videospiele?', 3, 'Milliarden', true),
  (4, 'Wie viele Millionen Zeilen Code stecken in Windows?', 50, 'Millionen', false),
  (4, 'Wie viele Ladezyklen hält ein Smartphone-Akku durch?', 500, 'Ladezyklen', false),
  (4, 'Wie viele Menschen arbeiten weltweit für Google?', 180000, 'Menschen', false),
  (4, 'Wie viele Millionen Artikel hat die deutsche Wikipedia?', 3, 'Millionen', false),
  (4, 'Wie viele Millionen Artikel hat die englische Wikipedia?', 7, 'Millionen', false),
  (4, 'Wie viele Fotos macht ein Mensch pro Jahr mit dem Handy?', 1000, 'Fotos', false),
  (4, 'Wie viele Tasten hat eine deutsche Standardtastatur?', 105, 'Tasten', false),
  (4, 'Wie viele Sekunden dauert Bohemian Rhapsody von Queen?', 355, 'Sekunden', false),
  (4, 'Wie viele Episoden hat Game of Thrones?', 73, 'Episoden', false),
  (4, 'Wie viele Pokémon gab es in der ersten Generation?', 151, 'Pokémon', false),
  (4, 'In welchem Jahr wurde Spotify gegründet?', 2006, 'Jahr', false),
  (4, 'Wie viele Milliarden Nachrichten laufen pro Tag über WhatsApp?', 100, 'Milliarden', true),
  (4, 'Wie viele Milliarden Menschen nutzen WhatsApp?', 3, 'Milliarden', true),
  (4, 'Wie viele Milliarden Menschen nutzen Instagram?', 2, 'Milliarden', true),
  (4, 'Wie viele Milliarden Menschen nutzen TikTok?', 1.6, 'Milliarden', true),
  (4, 'Wie viele Minuten pro Tag verbringt ein Teenager mit Social Media?', 180, 'Minuten', false),
  (4, 'Wie viele Milliarden Dollar Werbeumsatz macht Google pro Jahr?', 240, 'Milliarden', true),
  (4, 'Wie viel Prozent des weltweiten Stroms verbraucht das Internet?', 2, 'Prozent', false),
  (4, 'Wie viele Millionen Bitcoin wird es maximal geben?', 21, 'Millionen', false),
  (4, 'Wie viele Terawattstunden Strom verbraucht das Bitcoin-Netzwerk pro Jahr?', 150, 'Terawattstunden', false),
  (4, 'Wie viele Kilometer Unterseekabel liegen auf dem Meeresgrund?', 1400000, 'km', false),
  (4, 'Wie viele Sprachen unterstützt Google Translate?', 130, 'Sprachen', false),
  (4, 'Wie viele Stichwörter hat der Duden?', 148000, 'Wörter', false),
  (4, 'Wie viele Wörter benutzt ein Deutscher aktiv im Alltag?', 12000, 'Wörter', false),
  (4, 'Wie viele Bücher erscheinen pro Jahr neu in Deutschland?', 70000, 'Bücher', false),
  (4, 'Wie viele Milliarden Bibeln wurden bisher verkauft?', 5, 'Milliarden', true),
  (4, 'Wie viele Millionen Harry-Potter-Bücher wurden verkauft?', 600, 'Millionen', false),
  (4, 'Wie viele Millionen Exemplare verkaufte Michael Jacksons Thriller?', 70, 'Millionen', false),
  (4, 'Wie viele Millionen Menschen sahen das WM-Finale 2014 weltweit?', 1000, 'Millionen', false),
  (4, 'Wie viele Millionen Menschen schauen in den USA den Super Bowl?', 120, 'Millionen', false),
  (4, 'Wie viele Millionen Menschen schauen den Eurovision Song Contest?', 160, 'Millionen', false),
  (4, 'Wie viele Legosteine gibt es rechnerisch pro Mensch auf der Erde?', 100, 'Steine', false),
  (4, 'Wie viele Millionen Rubik''s Cubes wurden verkauft?', 450, 'Millionen', false),
  (4, 'Wie schnell ist der Weltrekord im Lösen eines Rubik''s Cube?', 3.13, 'Sekunden', false),
  (4, 'Wie viele Züge dauert eine durchschnittliche Schachpartie?', 40, 'Züge', false),
  (4, 'Wie viele Millionen Apps gibt es im App Store?', 1.8, 'Millionen', false),
  (4, 'Wie viele Apps sind auf einem durchschnittlichen Handy installiert?', 80, 'Apps', false),
  (4, 'Wie viele Fotos liegen auf einem durchschnittlichen Smartphone?', 2000, 'Fotos', false),
  (4, 'Wie viele Kilometer Kabel stecken in einem Airbus A380?', 500, 'km', false),
  (4, 'Wie viele Millionen Einzelteile hat ein Airbus A380?', 4, 'Millionen', false),
  (4, 'Wie viele Schriftzeichen hat das chinesische Schriftsystem?', 50000, 'Zeichen', false),
  (4, 'Wie viele Bearbeitungen bekommt Wikipedia pro Minute?', 350, 'Bearbeitungen', false),
  (4, 'Wie viele Milliarden Websites gibt es weltweit?', 1.1, 'Milliarden', true),
  (4, 'Wie viele Milliarden Videos liegen auf YouTube?', 14, 'Milliarden', true),
  (4, 'Wie viele Streams braucht man auf Spotify für 1.000 Euro?', 250000, 'Streams', true),
  (4, 'Wie viele Songs erscheinen pro Tag neu auf Spotify?', 100000, 'Songs', false),
  (4, 'Wie viele Sekunden dauert ein durchschnittlicher Popsong?', 200, 'Sekunden', false),
  (4, 'Wie viele Musiker sitzen in einem großen Sinfonieorchester?', 80, 'Musiker', false),
  (4, 'Wie viele Millionen Farben kann das menschliche Auge unterscheiden?', 10, 'Millionen', false),
  (4, 'Wie viele Millionen Pixel hat ein 4K-Bild?', 8.3, 'Millionen', false),
  (4, 'Wie viele Gigabyte groß ist ein moderner AAA-Spiele-Download?', 100, 'Gigabyte', false),
  (4, 'Wie viele Länder nehmen am Eurovision Song Contest teil?', 37, 'Länder', false),
  (4, 'Wie viele Millionen Dollar spielte Avengers Endgame weltweit ein?', 2800, 'Mio. Dollar', true),
  (4, 'Wie viele Millionen Podcasts gibt es weltweit?', 4, 'Millionen', false),
  (4, 'Wie viele Museen gibt es in Deutschland?', 6800, 'Museen', false),
  (4, 'Wie viele Millionen Kinobesuche gibt es pro Jahr in Deutschland?', 90, 'Millionen', false)
on conflict (text) do nothing;

-- ===== seed/003_badges.sql =====
insert into public.badges (key, title, rule) values
  ('serie7', 'Serie 7', '{"kind": "streak", "min": 7}'),
  ('serie20', 'Serie 20', '{"kind": "streak", "min": 20}'),
  ('volltreffer', 'Volltreffer', '{"kind": "score", "min": 95}'),
  ('duellsieg', 'Duellsieg', '{"kind": "duel_win"}'),
  ('nachteule', 'Nachteule', '{"kind": "attempt_hour", "before": 5}'),
  ('alle_kat', 'Alle Kat.', '{"kind": "all_categories_in_one_week"}'),
  ('aufstieg', 'Aufstieg', '{"kind": "league_promotion"}'),
  ('gold', 'Gold', '{"kind": "league_tier", "tier": "gold"}'),
  ('diamant', 'Diamant', '{"kind": "league_tier", "tier": "diamond_or_higher"}')
on conflict (key) do update set title = excluded.title, rule = excluded.rule;

-- ===== seed/004_bootstrap.sql =====
-- Run once after 0005_functions.sql and after seeding questions: creates
-- this calendar week's challenge immediately instead of waiting for the
-- Monday-00:00 cron tick, and does an initial standings pass so new
-- profiles have a points column that isn't just stale zeros.
select public.rotate_week();
select public.refresh_standings();

