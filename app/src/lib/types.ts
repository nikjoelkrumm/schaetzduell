import type { AvatarConfig } from "./avatar";

export interface Profile {
  id: string;
  name: string;
  is_guest: boolean;
  xp: number;
  level: number;
  streak: number;
  push_opt_in: boolean;
  invite_code: string;
  imported_local_save: boolean;
  last_completed_week: string | null;
  created_at: string;
  avatar: AvatarConfig;
}

export interface WeekQuestion {
  id: number;
  cat_id: number;
  cat_name: string;
  text: string;
  unit: string;
  volatile: boolean;
  position: number;
  answered: boolean;
  score: number | null;
}

export interface WeekPayload {
  iso_week: string;
  opens_at: string;
  closes_at: string;
  questions: WeekQuestion[];
}

export interface AttemptResult {
  score: number;
  truth: number;
  percentile?: number;
  idempotent?: boolean;
}

export interface DuelRound {
  round_id: string;
  n: number;
  closed: boolean;
  cat_name: string;
  text: string;
  unit: string;
  my_guess: number | null;
  my_score: number | null;
  opp_guess: number | null;
  opp_score: number | null;
  truth: number | null;
}

export interface DuelDetail {
  id: string;
  status: "active" | "finished";
  rounds: number;
  me: string;
  opponent: string;
  opponent_name: string;
  opponent_avatar: AvatarConfig;
  round_list: DuelRound[];
}

export interface DuelGuessResult {
  score: number;
  closed: boolean;
  opp_score: number | null;
  opp_guess: number | null;
  truth: number;
  idempotent?: boolean;
}

export interface PracticeQuestion {
  id: number;
  cat_id: number;
  cat_name: string;
  text: string;
  unit: string;
  volatile: boolean;
}

export interface AppNotification {
  id: string;
  profile_id: string;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
}
