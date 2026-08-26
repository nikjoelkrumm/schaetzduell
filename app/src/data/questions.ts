import raw from "./questions.json";
import { CATEGORIES } from "./categories";

export interface LocalQuestion {
  id: number; // index into the bundled array — NOT the Postgres questions.id
  catId: number;
  text: string;
  answer: number;
  unit: string;
}

// The 375 questions from schaetzduell-verbessert.html, bundled client-side so
// practice mode and the onboarding stats work with zero backend setup. The
// authoritative copy (with real Postgres ids, volatile flags, RLS-hidden
// answers) lives in supabase/seed/002_questions.sql — see ARCHITECTURE.md.
export const QUESTIONS: LocalQuestion[] = (raw as [number, string, number, string][]).map(
  ([catId, text, answer, unit], id) => ({ id, catId, text, answer, unit }),
);

export const TOTAL_QUESTIONS = QUESTIONS.length;

export function countByCategory(catId: number): number {
  return QUESTIONS.filter((q) => q.catId === catId).length;
}

export const CATEGORY_COUNTS = CATEGORIES.map((c) => ({ ...c, count: countByCategory(c.id) }));
