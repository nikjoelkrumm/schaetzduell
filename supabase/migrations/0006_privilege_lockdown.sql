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
