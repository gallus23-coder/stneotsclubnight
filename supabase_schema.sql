-- ============================================================
-- Club Night — Supabase Schema
-- Run this in your Supabase project SQL editor
-- ============================================================

-- Players
create table if not exists players (
  id bigint primary key generated always as identity,
  name text not null,
  handle text unique not null,
  color text not null,
  total_points int default 0,
  wins int default 0,
  losses int default 0,
  photo_url text,
  created_at timestamptz default now()
);

-- ============================================================
-- ⚠️  MIGRATION — run these if upgrading an existing database
--    (safe to run even if columns already exist)
-- ============================================================
alter table players add column if not exists total_points int default 0;
alter table players add column if not exists wins int default 0;
alter table players add column if not exists losses int default 0;
alter table players add column if not exists photo_url text;

-- ============================================================
-- RPC function — atomic increment of player stats
-- Prevents race conditions when multiple games finish at once
-- ============================================================
create or replace function increment_player_stats(
  p_id     bigint,
  p_points int,
  p_wins   int,
  p_losses int default 0
)
returns void
language sql
security definer
as $$
  update players
  set
    total_points = total_points + p_points,
    wins         = wins         + p_wins,
    losses       = losses       + p_losses
  where id = p_id;
$$;

-- Courts
create table if not exists courts (
  id bigint primary key generated always as identity,
  name text not null,
  max_players int default 4,
  created_at timestamptz default now()
);

-- Who is on which court right now
create table if not exists court_players (
  court_id bigint references courts(id) on delete cascade,
  player_id bigint references players(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (court_id, player_id)
);

-- Waiting list
create table if not exists waiting_list (
  id bigint primary key generated always as identity,
  player_id bigint references players(id) on delete cascade,
  joined_at timestamptz default now()
);

-- Per-court score history
create table if not exists score_history (
  id bigint primary key generated always as identity,
  court_id bigint references courts(id) on delete cascade,
  team1_label text,
  team2_label text,
  score1 int,
  score2 int,
  recorded_at timestamptz default now()
);

-- ============================================================
-- Row Level Security — open policies (tighten with auth later)
-- ============================================================
alter table players        enable row level security;
alter table courts         enable row level security;
alter table court_players  enable row level security;
alter table waiting_list   enable row level security;
alter table score_history  enable row level security;

create policy "public access" on players        for all using (true) with check (true);
create policy "public access" on courts         for all using (true) with check (true);
create policy "public access" on court_players  for all using (true) with check (true);
create policy "public access" on waiting_list   for all using (true) with check (true);
create policy "public access" on score_history  for all using (true) with check (true);

-- ============================================================
-- Seed data (delete if not needed)
-- ============================================================
insert into courts (name, max_players) values
  ('Court 1', 4),
  ('Court 2', 4),
  ('Court 3', 4);
