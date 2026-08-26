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
