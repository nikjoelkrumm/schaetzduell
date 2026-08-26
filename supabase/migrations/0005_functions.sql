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
