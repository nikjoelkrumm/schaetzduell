import { requireSupabase } from "./supabase";
import type {
  AttemptResult,
  DuelDetail,
  DuelGuessResult,
  PracticeQuestion,
  Profile,
  WeekPayload,
} from "./types";

// Thin typed wrappers around the RPCs in supabase/migrations/0005_functions.sql.
// Every write in here is server-authoritative — none of these compute a score
// client-side and send it up; the server always does that math.

export async function getWeek(): Promise<WeekPayload> {
  const { data, error } = await requireSupabase().rpc("get_week");
  if (error) throw error;
  return data as WeekPayload;
}

export async function submitAttempt(questionId: number, guess: number, idemKey: string): Promise<AttemptResult> {
  const { data, error } = await requireSupabase().rpc("submit_attempt", {
    p_question_id: questionId,
    p_guess: guess,
    p_idem_key: idemKey,
  });
  if (error) throw error;
  return data as AttemptResult;
}

export async function practiceQuestions(catIds: number[], count = 20): Promise<PracticeQuestion[]> {
  const { data, error } = await requireSupabase().rpc("practice_questions", {
    p_cat_ids: catIds,
    p_count: count,
  });
  if (error) throw error;
  return data as PracticeQuestion[];
}

export async function practiceGuess(questionId: number, guess: number): Promise<{ score: number; truth: number }> {
  const { data, error } = await requireSupabase().rpc("practice_guess", {
    p_question_id: questionId,
    p_guess: guess,
  });
  if (error) throw error;
  return data as { score: number; truth: number };
}

export async function createDuel(opponentId: string, rounds = 6, rematchOf?: string): Promise<string> {
  const { data, error } = await requireSupabase().rpc("create_duel", {
    p_opponent_id: opponentId,
    p_rounds: rounds,
    p_rematch_of: rematchOf ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function getDuel(duelId: string): Promise<DuelDetail> {
  const { data, error } = await requireSupabase().rpc("get_duel", { p_duel_id: duelId });
  if (error) throw error;
  return data as DuelDetail;
}

export async function submitDuelGuess(roundId: string, guess: number, idemKey: string): Promise<DuelGuessResult> {
  const { data, error } = await requireSupabase().rpc("submit_duel_guess", {
    p_round_id: roundId,
    p_guess: guess,
    p_idem_key: idemKey,
  });
  if (error) throw error;
  return data as DuelGuessResult;
}

export async function redeemInvite(code: string): Promise<{ friend_id: string; friend_name: string }> {
  const { data, error } = await requireSupabase().rpc("redeem_invite", { p_code: code });
  if (error) throw error;
  return data as { friend_id: string; friend_name: string };
}

export async function sendFriendRequest(targetId: string): Promise<{ target_name: string }> {
  const { data, error } = await requireSupabase().rpc("send_friend_request", { p_target_id: targetId });
  if (error) throw error;
  return data as { target_name: string };
}

export async function respondFriendRequest(targetId: string, accept: boolean): Promise<void> {
  const { error } = await requireSupabase().rpc("respond_friend_request", {
    p_target_id: targetId,
    p_accept: accept,
  });
  if (error) throw error;
}

// Returns a duel id once matched, or null if still waiting in the queue —
// the caller polls this every couple of seconds until it's non-null.
export async function findOrCreateMatch(rounds = 6): Promise<string | null> {
  const { data, error } = await requireSupabase().rpc("find_or_create_match", { p_rounds: rounds });
  if (error) throw error;
  return data as string | null;
}

export async function cancelMatchmaking(): Promise<void> {
  const { error } = await requireSupabase().rpc("cancel_matchmaking");
  if (error) throw error;
}

export async function reportQuestion(questionId: number, reason: string): Promise<void> {
  const { error } = await requireSupabase().rpc("report_question", {
    p_question_id: questionId,
    p_reason: reason,
  });
  if (error) throw error;
}

export async function exportMyData(): Promise<unknown> {
  const { data, error } = await requireSupabase().rpc("export_my_data");
  if (error) throw error;
  return data;
}

export async function deleteMyAccount(): Promise<void> {
  const { error } = await requireSupabase().rpc("delete_my_account");
  if (error) throw error;
}

export interface DuelListItem {
  id: string;
  status: "active" | "finished";
  rounds: number;
  created_at: string;
  opponent_name: string;
  my_total: number;
  opp_total: number;
  my_turn: boolean;
  rounds_closed: number;
}

// Fans out to get_duel() per duel rather than hand-joining duel_rounds /
// duel_guesses client-side. A player's duel list is small by design (the
// free tier caps concurrent duels at three), so this stays cheap and reuses
// the already-correct per-duel aggregation instead of duplicating it.
export async function listDuels(myId: string): Promise<DuelListItem[]> {
  const sb = requireSupabase();
  const { data: duels, error } = await sb
    .from("duels")
    .select("id, status, rounds, created_at")
    .or(`a_id.eq.${myId},b_id.eq.${myId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!duels || duels.length === 0) return [];

  const details = await Promise.all(duels.map((d) => getDuel(d.id)));

  return duels.map((d, i) => {
    const detail = details[i];
    const myTotal = detail.round_list.reduce((s, r) => s + (r.my_score ?? 0), 0);
    const oppTotal = detail.round_list.reduce((s, r) => s + (r.opp_score ?? 0), 0);
    const myTurn = d.status === "active" && detail.round_list.some((r) => !r.closed && r.my_guess == null);
    return {
      id: d.id,
      status: d.status,
      rounds: d.rounds,
      created_at: d.created_at,
      opponent_name: detail.opponent_name,
      my_total: myTotal,
      opp_total: oppTotal,
      my_turn: myTurn,
      rounds_closed: detail.round_list.filter((r) => r.closed).length,
    };
  });
}

export interface FriendItem {
  id: string;
  name: string;
  xp: number;
  streak: number;
}

export interface FriendRequestItem {
  id: string;
  name: string;
}

export interface FriendData {
  accepted: FriendItem[];
  incoming: FriendRequestItem[]; // requests sent TO me — I can accept/decline
  outgoing: FriendRequestItem[]; // requests I sent — waiting on them
}

export async function listFriendData(myId: string): Promise<FriendData> {
  const sb = requireSupabase();
  const { data: rows, error } = await sb
    .from("friendships")
    .select("a_id, b_id, status, requested_by")
    .or(`a_id.eq.${myId},b_id.eq.${myId}`);
  if (error) throw error;

  const otherIds = (rows ?? []).map((r) => (r.a_id === myId ? r.b_id : r.a_id));
  const { data: people } = otherIds.length
    ? await sb.from("profile_public").select("id, name, xp, streak").in("id", otherIds)
    : { data: [] as { id: string; name: string; xp: number; streak: number }[] };
  const byId = new Map((people ?? []).map((p) => [p.id, p]));

  const result: FriendData = { accepted: [], incoming: [], outgoing: [] };
  for (const r of rows ?? []) {
    const otherId = r.a_id === myId ? r.b_id : r.a_id;
    const person = byId.get(otherId);
    if (!person) continue;
    if (r.status === "accepted") {
      result.accepted.push(person);
    } else if (r.requested_by === myId) {
      result.outgoing.push({ id: person.id, name: person.name });
    } else {
      result.incoming.push({ id: person.id, name: person.name });
    }
  }
  return result;
}

export interface StandingRow {
  profile_id: string;
  name: string;
  points: number;
  streak: number;
}

export interface LeagueInfo {
  seasonId: string;
  tier: string;
  groupNo: number;
  endsAt: string;
  standings: StandingRow[];
  myRank: number;
  groupSize: number;
}

export async function getMyLeague(myId: string): Promise<LeagueInfo | null> {
  const sb = requireSupabase();
  const { data: mine } = await sb
    .from("standings")
    .select("season_id, league_seasons!inner(tier, group_no, ends_at)")
    .eq("profile_id", myId)
    .gt("league_seasons.ends_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (!mine) return null;

  const seasonId = mine.season_id as string;
  const season = mine.league_seasons as unknown as { tier: string; group_no: number; ends_at: string };

  // profile_public is a view (no FK PostgREST can embed through), so this is
  // a plain two-step fetch + client-side merge rather than an embedded join —
  // same pattern as listFriends() above.
  const { data: rows } = await sb
    .from("standings")
    .select("profile_id, points")
    .eq("season_id", seasonId)
    .order("points", { ascending: false });

  const ids = (rows ?? []).map((r) => r.profile_id);
  const { data: people } = ids.length
    ? await sb.from("profile_public").select("id, name, streak").in("id", ids)
    : { data: [] as { id: string; name: string; streak: number }[] };
  const byId = new Map((people ?? []).map((p) => [p.id, p]));

  const standings: StandingRow[] = (rows ?? []).map((r) => ({
    profile_id: r.profile_id,
    points: r.points,
    name: byId.get(r.profile_id)?.name ?? "Unbekannt",
    streak: byId.get(r.profile_id)?.streak ?? 0,
  }));

  return {
    seasonId,
    tier: season.tier,
    groupNo: season.group_no,
    endsAt: season.ends_at,
    standings,
    myRank: standings.findIndex((s) => s.profile_id === myId) + 1,
    groupSize: standings.length,
  };
}

export type FriendshipStatus = "none" | "accepted" | "outgoing" | "incoming";

export async function getFriendshipStatus(myId: string, otherId: string): Promise<FriendshipStatus> {
  const sb = requireSupabase();
  const a = myId < otherId ? myId : otherId;
  const b = myId < otherId ? otherId : myId;
  const { data } = await sb.from("friendships").select("status, requested_by").eq("a_id", a).eq("b_id", b).maybeSingle();
  if (!data) return "none";
  if (data.status === "accepted") return "accepted";
  return data.requested_by === myId ? "outgoing" : "incoming";
}

export async function getProfileBadges(myId: string): Promise<string[]> {
  const { data } = await requireSupabase().from("profile_badges").select("badge_key").eq("profile_id", myId);
  return (data ?? []).map((b) => b.badge_key as string);
}

export async function updateProfileFields(myId: string, patch: Partial<Profile>): Promise<void> {
  const { error } = await requireSupabase().from("profiles").update(patch).eq("id", myId);
  if (error) throw error;
}
