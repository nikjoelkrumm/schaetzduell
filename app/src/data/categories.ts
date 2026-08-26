export interface Category {
  id: number;
  name: string;
  description: string;
}

// Mirrors supabase/seed/001_categories.sql exactly (id must match cat_id).
export const CATEGORIES: Category[] = [
  { id: 0, name: "Körper & Sport", description: "Puls, Kalorien, Rekorde, Stadien" },
  { id: 1, name: "Welt & Natur", description: "Tiere, Ozeane, Wetter, Weltall" },
  { id: 2, name: "Alltag & Zahlen", description: "Essen, Wohnen, Gewohnheiten" },
  { id: 3, name: "Geld & Business", description: "Preise, Gehälter, Konzerne" },
  { id: 4, name: "Tech & Kultur", description: "Internet, Games, Film, Musik" },
];

export const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));
