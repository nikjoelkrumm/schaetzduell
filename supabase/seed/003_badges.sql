insert into public.badges (key, title, rule) values
  ('serie7', 'Serie 7', '{"kind": "streak", "min": 7}'),
  ('serie20', 'Serie 20', '{"kind": "streak", "min": 20}'),
  ('volltreffer', 'Volltreffer', '{"kind": "score", "min": 95}'),
  ('duellsieg', 'Duellsieg', '{"kind": "duel_win"}'),
  ('nachteule', 'Nachteule', '{"kind": "attempt_hour", "before": 5}'),
  ('alle_kat', 'Alle Kat.', '{"kind": "all_categories_in_one_week"}'),
  ('aufstieg', 'Aufstieg', '{"kind": "league_promotion"}'),
  ('gold', 'Gold', '{"kind": "league_tier", "tier": "gold"}'),
  ('diamant', 'Diamant', '{"kind": "league_tier", "tier": "diamond_or_higher"}')
on conflict (key) do update set title = excluded.title, rule = excluded.rule;
