# Schätzduell — app

React + TypeScript + Vite frontend. See `../SUPABASE_SETUP.md` first — most
of this app needs a real Supabase project to do anything, and won't crash
without one, but won't be very interesting either.

```
npm install
cp .env.example .env.local   # then fill in your Supabase project's URL + anon key
npm run dev
```

## Structure

- `src/screens/` — one file per screen (some, like the guess/reveal pair,
  share a component across the design's separate "screens" since they're
  really one flow with two render states — see `GuessFlow.tsx`).
- `src/lib/db.ts` — typed wrappers around the Supabase RPCs; this is the only
  place that talks to the backend for anything that writes data.
- `src/lib/scoring.ts` — the guess parser and scoring formula, ported from
  `../project/uploads/Schätzduell/schaetzduell-verbessert.html`. Client-side
  only for optimistic UI — the server (`supabase/migrations/0005_functions.sql`)
  is the source of truth for any score that counts.
- `src/state/AuthContext.tsx` — session + profile, sign up/in, magic link,
  guest (anonymous) auth.
- `src/styles/tokens.css` — the Petrol/Amber/Archivo design tokens from the
  Claude Design handoff.
- `src/data/questions.json` — the 375-question set, bundled client-side only
  for static display (onboarding's "375 Fragen" stat, category counts) —
  actual gameplay always fetches questions from the server so an answer
  never ships to the client before it's guessed.

## Scripts

- `npm run dev` — dev server
- `npm run build` — typecheck (`tsc -b`) + production build
- `npm run lint` — oxlint
