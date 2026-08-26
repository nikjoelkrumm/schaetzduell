-- Run once after 0005_functions.sql and after seeding questions: creates
-- this calendar week's challenge immediately instead of waiting for the
-- Monday-00:00 cron tick, and does an initial standings pass so new
-- profiles have a points column that isn't just stale zeros.
select public.rotate_week();
select public.refresh_standings();
