-- Run this entire file once in Supabase > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.rooms (
  code text primary key,
  host_id uuid not null,
  status text not null default 'lobby',
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  room_code text not null references public.rooms(code) on delete cascade,
  user_id uuid not null,
  name text not null,
  seat int not null,
  ready boolean not null default false,
  character text,
  public_state jsonb not null default '{}'::jsonb,
  private_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(room_code,user_id), unique(room_code,seat), unique(room_code,character)
);

alter table public.rooms enable row level security;
alter table public.players enable row level security;

-- Trusted-friends beta policies. They allow authenticated guests in a room to read/write game state.
-- Do not use for a public competitive release without server-authoritative functions.
drop policy if exists rooms_select on public.rooms;
create policy rooms_select on public.rooms for select to authenticated using (true);
drop policy if exists rooms_insert on public.rooms;
create policy rooms_insert on public.rooms for insert to authenticated with check (host_id=auth.uid());
drop policy if exists rooms_update on public.rooms;
create policy rooms_update on public.rooms for update to authenticated using (exists(select 1 from public.players p where p.room_code=rooms.code and p.user_id=auth.uid()));

drop policy if exists players_select on public.players;
create policy players_select on public.players for select to authenticated using (true);
drop policy if exists players_insert on public.players;
create policy players_insert on public.players for insert to authenticated with check (user_id=auth.uid());
drop policy if exists players_update on public.players;
create policy players_update on public.players for update to authenticated using (exists(select 1 from public.players me where me.room_code=players.room_code and me.user_id=auth.uid()));

-- Realtime publication
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.players;
