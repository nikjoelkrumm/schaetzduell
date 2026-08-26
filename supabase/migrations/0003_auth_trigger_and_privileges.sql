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
