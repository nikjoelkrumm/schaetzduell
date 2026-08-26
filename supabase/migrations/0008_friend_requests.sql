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
