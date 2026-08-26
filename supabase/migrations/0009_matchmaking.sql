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
