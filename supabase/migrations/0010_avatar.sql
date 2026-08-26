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
