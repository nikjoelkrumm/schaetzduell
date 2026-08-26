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
