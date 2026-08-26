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
