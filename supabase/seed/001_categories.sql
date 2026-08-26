insert into public.categories (id, name, description) values
  (0, 'Körper & Sport', 'Puls, Kalorien, Rekorde, Stadien'),
  (1, 'Welt & Natur', 'Tiere, Ozeane, Wetter, Weltall'),
  (2, 'Alltag & Zahlen', 'Essen, Wohnen, Gewohnheiten'),
  (3, 'Geld & Business', 'Preise, Gehälter, Konzerne'),
  (4, 'Tech & Kultur', 'Internet, Games, Film, Musik')
on conflict (id) do update set name = excluded.name, description = excluded.description;
