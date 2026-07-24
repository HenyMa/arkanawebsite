-- ===========================================================================
-- ARKANA — database schema
--
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste
-- -> Run. It is idempotent, so it is safe to re-run after edits.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- profiles: one row per member, created automatically on sign-up.
-- `points` is the spendable balance; `lifetime_spend_cents` drives tier.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                    uuid primary key references auth.users on delete cascade,
  email                 text,
  full_name             text,
  points                integer not null default 0,
  lifetime_spend_cents  bigint  not null default 0,
  created_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- orders: written by the Stripe webhook, never by the browser.
-- user_id is nullable so guest checkouts are still recorded.
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid references public.profiles(id) on delete set null,
  stripe_session_id      text unique not null,
  stripe_payment_intent  text,
  email                  text,
  amount_subtotal_cents  integer not null default 0,
  amount_total_cents     integer not null default 0,
  currency               text not null default 'usd',
  status                 text not null default 'paid',
  items                  jsonb not null default '[]'::jsonb,
  shipping               jsonb,
  points_awarded         integer not null default 0,
  created_at             timestamptz not null default now()
);

create index if not exists orders_user_id_idx on public.orders (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- points_ledger: append-only audit trail. Every change to profiles.points
-- should have a matching row here so a balance can always be explained.
-- ---------------------------------------------------------------------------
create table if not exists public.points_ledger (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  delta      integer not null,
  reason     text not null,
  order_id   uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists points_ledger_user_id_idx
  on public.points_ledger (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row-level security. The anon/authenticated roles may only ever see their own
-- rows; the webhook uses the service-role key, which bypasses these policies.
-- ---------------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.orders        enable row level security;
alter table public.points_ledger enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "read own orders" on public.orders;
create policy "read own orders" on public.orders
  for select using (auth.uid() = user_id);

drop policy if exists "read own ledger" on public.points_ledger;
create policy "read own ledger" on public.points_ledger
  for select using (auth.uid() = user_id);

-- Note: there is deliberately no INSERT policy on orders or points_ledger.
-- Only the service role writes them, so members cannot mint themselves points.

-- ---------------------------------------------------------------------------
-- Sign-up hook: create the profile and grant the 100-point joining bonus.
-- Kept in a trigger rather than app code so it fires for every sign-up path
-- (email, OAuth, magic link, dashboard-created users).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  signup_bonus constant integer := 100;  -- keep in sync with src/lib/rewards.ts
begin
  insert into public.profiles (id, email, full_name, points)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    signup_bonus
  )
  on conflict (id) do nothing;

  insert into public.points_ledger (user_id, delta, reason)
  values (new.id, signup_bonus, 'Welcome to the Arkana Circle');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Credits an order atomically: bumps points + lifetime spend and writes the
-- ledger row in a single transaction. Called by the Stripe webhook via RPC so
-- a crash mid-way can never leave the balance and the ledger disagreeing.
-- ---------------------------------------------------------------------------
create or replace function public.award_points(
  p_user_id  uuid,
  p_points   integer,
  p_spend    integer,
  p_order_id uuid,
  p_reason   text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set points = points + p_points,
         lifetime_spend_cents = lifetime_spend_cents + p_spend
   where id = p_user_id;

  if p_points <> 0 then
    insert into public.points_ledger (user_id, delta, reason, order_id)
    values (p_user_id, p_points, p_reason, p_order_id);
  end if;
end;
$$;
