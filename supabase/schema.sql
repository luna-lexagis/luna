-- supabase/schema.sql
-- Run this in Supabase dashboard → SQL Editor → New query → Run.

create extension if not exists pgcrypto;

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  caratula text not null default '',
  delito text not null default '',
  rol text not null default 'defensa',
  departamento_judicial text,
  fase_actual text not null default 'preparacion',
  data jsonb not null default '{}'::jsonb
);

alter table public.cases enable row level security;

create policy "own cases - select" on public.cases
  for select using (auth.uid() = user_id);
create policy "own cases - insert" on public.cases
  for insert with check (auth.uid() = user_id);
create policy "own cases - update" on public.cases
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own cases - delete" on public.cases
  for delete using (auth.uid() = user_id);
