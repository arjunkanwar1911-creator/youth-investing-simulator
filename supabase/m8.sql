-- M8: where each learner's portfolio and trades live.
-- Run this once in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query -> paste -> Run).
-- It is safe to run twice: nothing is dropped except the policies, which are put straight back.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

-- One row per learner: their cash and what they own right now.
-- Money is in whole paise, same as the app. Holdings look like
-- {"SPY": {"quantity": 2, "costPaise": 14400000}}.
create table if not exists public.portfolios (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  cash_paise  bigint not null check (cash_paise >= 0),
  holdings    jsonb  not null default '{}'::jsonb check (jsonb_typeof(holdings) = 'object'),
  updated_at  timestamptz not null default now()
);

-- One row per trade. (user_id, n) is the key: n is the trade's place in that
-- learner's history (0, 1, 2 ...). Saving the same trade twice therefore can never
-- create a duplicate.
create table if not exists public.trades (
  user_id      uuid    not null references auth.users (id) on delete cascade,
  n            integer not null check (n >= 0),
  side         text    not null check (side in ('buy', 'sell')),
  symbol       text    not null check (char_length(symbol) between 1 and 12),
  quantity     bigint  not null check (quantity > 0),      -- whole shares only
  price_paise  bigint  not null check (price_paise > 0),
  total_paise  bigint  not null check (total_paise > 0),
  price_date   date,                                       -- the day the price was from
  created_at   timestamptz not null default now(),
  primary key (user_id, n)
);

-- ---------------------------------------------------------------------------
-- 2. Row level security: switch the lock on
-- With it on and no policy, nobody can see or change any row.
-- ---------------------------------------------------------------------------

alter table public.portfolios enable row level security;
alter table public.trades     enable row level security;

-- ---------------------------------------------------------------------------
-- 3. Policies: the keys. auth.uid() is the id of whoever is signed in.
-- A row is only visible or changeable when its user_id is the same person.
-- (select auth.uid()) is the faster way to write it: it is worked out once, not per row.
-- ---------------------------------------------------------------------------

drop policy if exists "own portfolio: read"   on public.portfolios;
drop policy if exists "own portfolio: add"    on public.portfolios;
drop policy if exists "own portfolio: change" on public.portfolios;
drop policy if exists "own portfolio: delete" on public.portfolios;

create policy "own portfolio: read"   on public.portfolios for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own portfolio: add"    on public.portfolios for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "own portfolio: change" on public.portfolios for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);   -- you cannot hand a row to someone else
create policy "own portfolio: delete" on public.portfolios for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "own trades: read"   on public.trades;
drop policy if exists "own trades: add"    on public.trades;
drop policy if exists "own trades: delete" on public.trades;

create policy "own trades: read"   on public.trades for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own trades: add"    on public.trades for insert to authenticated
  with check ((select auth.uid()) = user_id);
-- Delete is only so "start again" can clear a learner's own history.
-- There is no update policy on purpose: a trade, once made, never changes.
create policy "own trades: delete" on public.trades for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 4. Grants: who may even knock on the door.
-- New tables are not exposed to the app automatically, so we say it out loud.
-- Signed-in learners ("authenticated") get exactly what the policies describe.
-- Signed-out visitors ("anon") get nothing at all.
-- ---------------------------------------------------------------------------

revoke all on public.portfolios from anon;
revoke all on public.trades     from anon;

grant select, insert, update, delete on public.portfolios to authenticated;
grant select, insert, delete         on public.trades     to authenticated;
