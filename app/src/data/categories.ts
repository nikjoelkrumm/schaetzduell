export interface Category {
  id: number;
  name: string;
  description: string;
  color: string;
}

// Mirrors supabase/seed/001_categories.sql exactly (id must match cat_id).
// Colors are the categorical palette from the original schaetzduell-verbessert.html
// build's `COL` array — reused here so each category reads as its own color
// instead of everything defaulting to amber.
export const CATEGORIES: Category[] = [
  { id: 0, name: "Körper & Sport", description: "Puls, Kalorien, Rekorde, Stadien", color: "#F0B429" },
  { id: 1, name: "Welt & Natur", description: "Tiere, Ozeane, Wetter, Weltall", color: "#5FBF8B" },
  { id: 2, name: "Alltag & Zahlen", description: "Essen, Wohnen, Gewohnheiten", color: "#4EA8DE" },
  { id: 3, name: "Geld & Business", description: "Preise, Gehälter, Konzerne", color: "#C77DFF" },
  { id: 4, name: "Tech & Kultur", description: "Internet, Games, Film, Musik", color: "#F27B9D" },
];

export const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export function categoryColor(catId: number): string {
  return CATEGORY_BY_ID.get(catId)?.color ?? "#F0B429";
}

const COLOR_BY_NAME = new Map(CATEGORIES.map((c) => [c.name, c.color]));

// For call sites that only have the category's display name (e.g. a duel
// round from the server), not its numeric id.
export function categoryColorByName(name: string): string {
  return COLOR_BY_NAME.get(name) ?? "#F0B429";
}
