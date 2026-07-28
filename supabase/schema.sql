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

-- Set the first time a member checks out with the welcome discount applied.
-- Non-null means the 20% has been used and can never be granted again.
alter table public.profiles
  add column if not exists welcome_discount_used_at timestamptz;

-- A tier bought outright rather than earned by spending. Written only by
-- grant_membership() below, off the back of a paid Stripe session — never by
-- the member, who has no UPDATE grant on these columns (see ADMIN section).
alter table public.profiles
  add column if not exists purchased_tier text;
alter table public.profiles
  add column if not exists purchased_tier_at timestamptz;

-- `add constraint if not exists` doesn't exist, so guard it by name.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_purchased_tier_check'
  ) then
    alter table public.profiles
      add constraint profiles_purchased_tier_check
      check (purchased_tier is null or purchased_tier in ('Adept', 'Oracle'));
  end if;
end
$$;

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

-- `discount_cents` is what came off the order (welcome discount, promo code).
-- Returns pro-rate against it so a partial refund never exceeds what was paid.
alter table public.orders
  add column if not exists discount_cents integer not null default 0;

-- Running total refunded across every return on the order.
alter table public.orders
  add column if not exists refunded_cents integer not null default 0;

create index if not exists orders_user_id_idx on public.orders (user_id, created_at desc);
create index if not exists orders_payment_intent_idx
  on public.orders (stripe_payment_intent);

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
-- returns: one row per return request.
--
-- Members open these themselves (status 'requested') and may cancel while the
-- request is still untouched. Everything past that — approving, marking
-- received, refunding — is done with the service-role key, so a member can
-- never move their own return to 'refunded'.
--
-- Statuses: requested | approved | in_transit | received | refunded
--           | rejected | cancelled          (mirrors src/lib/returns.ts)
-- ---------------------------------------------------------------------------
create table if not exists public.returns (
  id                   uuid primary key default gen_random_uuid(),
  order_id             uuid not null references public.orders(id) on delete cascade,
  user_id              uuid not null references public.profiles(id) on delete cascade,
  rma_code             text unique not null,
  status               text not null default 'requested',
  reason               text not null,
  comment              text,
  -- [{slug, name, size, quantity, unit_price_cents}] — snapshotted at request
  -- time so the record still reads correctly if the catalogue changes.
  items                jsonb   not null default '[]'::jsonb,
  -- What the returned items are worth back, after their share of any discount.
  refund_amount_cents  integer not null default 0,
  -- Actually refunded via Stripe. Written by the webhook, not by the studio.
  refunded_cents       integer not null default 0,
  points_reversed      integer not null default 0,
  free_postage         boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint returns_status_check check (status in (
    'requested', 'approved', 'in_transit', 'received',
    'refunded', 'rejected', 'cancelled'
  ))
);

create index if not exists returns_user_id_idx
  on public.returns (user_id, created_at desc);
create index if not exists returns_order_id_idx on public.returns (order_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists returns_touch_updated_at on public.returns;
create trigger returns_touch_updated_at
  before update on public.returns
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security. The anon/authenticated roles may only ever see their own
-- rows; the webhook uses the service-role key, which bypasses these policies.
-- ---------------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.orders        enable row level security;
alter table public.points_ledger enable row level security;
alter table public.returns       enable row level security;

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

drop policy if exists "read own returns" on public.returns;
create policy "read own returns" on public.returns
  for select using (auth.uid() = user_id);

-- A member may open a return, but only against an order that is theirs, only
-- in the 'requested' state, and only with the money fields left at zero. The
-- API route re-checks all of this; the policy is the backstop if it ever
-- doesn't.
drop policy if exists "open own return" on public.returns;
create policy "open own return" on public.returns
  for insert with check (
    auth.uid() = user_id
    and status = 'requested'
    and refunded_cents = 0
    and points_reversed = 0
    and exists (
      select 1 from public.orders o
       where o.id = returns.order_id
         and o.user_id = auth.uid()
    )
  );

-- Cancelling is the only update a member can make, and only before we've
-- actioned the request. USING pins the row's current state, WITH CHECK pins
-- what it may become.
drop policy if exists "cancel own return" on public.returns;
create policy "cancel own return" on public.returns
  for update using (auth.uid() = user_id and status = 'requested')
          with check (auth.uid() = user_id and status = 'cancelled');

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
  -- Clamped at zero: a refund calls this with negative values, and a member
  -- who has already spent their points must never end up with a debt.
  update public.profiles
     set points = greatest(0, points + p_points),
         lifetime_spend_cents = greatest(0, lifetime_spend_cents + p_spend)
   where id = p_user_id;

  if p_points <> 0 then
    insert into public.points_ledger (user_id, delta, reason, order_id)
    values (p_user_id, p_points, p_reason, p_order_id);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Settles a refund atomically: bumps the order's refunded total, claws back the
-- pro-rated points and lifetime spend, and closes out the return it belongs to.
--
-- Called by the Stripe webhook on charge.refunded — the refund itself is issued
-- from the Stripe dashboard, and this is how the site catches up. Idempotent on
-- p_refund_cents being the *delta* the caller computed, so a redelivered event
-- that adds nothing is a no-op.
-- ---------------------------------------------------------------------------
create or replace function public.record_refund(
  p_order_id     uuid,
  p_user_id      uuid,
  p_refund_cents integer,
  p_points       integer,
  p_return_id    uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.orders
     set refunded_cents = refunded_cents + p_refund_cents,
         status = case
                    when refunded_cents + p_refund_cents >= amount_total_cents
                    then 'refunded'
                    else 'partially_refunded'
                  end
   where id = p_order_id;

  if p_return_id is not null then
    update public.returns
       set status = 'refunded',
           refunded_cents = refunded_cents + p_refund_cents,
           points_reversed = points_reversed + p_points
     where id = p_return_id;
  end if;

  if p_user_id is not null then
    perform public.award_points(
      p_user_id, -p_points, -p_refund_cents, p_order_id, 'Refund adjustment'
    );
  end if;
end;
$$;

-- ===========================================================================
-- MEMBERSHIPS — tiers bought outright
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- memberships: one row per purchase, written only by the Stripe webhook.
--
-- Deliberately not in `orders`: a membership has no items, earns no points,
-- moves no lifetime spend, and can't be returned — so every row in `orders`
-- keeps the property that returns and refund pro-rating depend on.
-- ---------------------------------------------------------------------------
create table if not exists public.memberships (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.profiles(id) on delete cascade,
  tier                   text not null,
  stripe_session_id      text unique not null,
  stripe_payment_intent  text,
  amount_cents           integer not null default 0,
  created_at             timestamptz not null default now(),

  constraint memberships_tier_check check (tier in ('Adept', 'Oracle'))
);

create index if not exists memberships_user_id_idx
  on public.memberships (user_id, created_at desc);

alter table public.memberships enable row level security;

-- Members read their own receipts. There is no INSERT/UPDATE/DELETE policy at
-- all, so the only writer is the service role — nobody can grant themselves a
-- tier by talking to the API with the anon key.
drop policy if exists "read own memberships" on public.memberships;
create policy "read own memberships" on public.memberships
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- tier_rank(): tiers as comparable numbers, so a membership can only ever move
-- someone up. Keep in sync with TIERS in src/lib/rewards.ts.
-- ---------------------------------------------------------------------------
create or replace function public.tier_rank(p_tier text)
returns integer
language sql
immutable
as $$
  select case p_tier
           when 'Adept'  then 1
           when 'Oracle' then 2
           else 0
         end;
$$;

-- ---------------------------------------------------------------------------
-- Grants a paid-for tier, atomically.
--
-- Idempotent on stripe_session_id: a redelivered webhook inserts nothing and
-- then does nothing, so the same payment can never be honoured twice. And the
-- profile is only updated when the new tier outranks the one already held, so
-- an Oracle who later buys Adept stays Oracle.
-- ---------------------------------------------------------------------------
create or replace function public.grant_membership(
  p_user_id        uuid,
  p_tier           text,
  p_session_id     text,
  p_payment_intent text,
  p_amount_cents   integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  new_rank integer := public.tier_rank(p_tier);
begin
  if new_rank = 0 then
    raise exception 'Unknown membership tier: %', p_tier;
  end if;

  insert into public.memberships (
    user_id, tier, stripe_session_id, stripe_payment_intent, amount_cents
  )
  values (p_user_id, p_tier, p_session_id, p_payment_intent, p_amount_cents)
  on conflict (stripe_session_id) do nothing;

  -- Nothing inserted means we've already processed this session.
  if not found then
    return;
  end if;

  update public.profiles
     set purchased_tier = p_tier,
         purchased_tier_at = now()
   where id = p_user_id
     and public.tier_rank(coalesce(purchased_tier, '')) < new_rank;
end;
$$;

-- ===========================================================================
-- ADMIN
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Lock down profile self-updates.
--
-- Row-level security scopes *rows*, not *columns*: the "update own profile"
-- policy above says a member may update their own row, and nothing stopped them
-- from setting `points` or `lifetime_spend_cents` on it. With the default
-- Supabase grants, a signed-in member could mint themselves an Oracle-tier
-- balance using only the public anon key.
--
-- Column-level grants are the fix, and they are why admin lives in its own
-- table below rather than as a flag here — a self-writable `is_admin` column
-- would have handed every member the keys.
--
-- `full_name` is the entire whitelist, so `purchased_tier` is covered by the
-- same rule: a member can no more grant themselves Oracle than mint points.
-- ---------------------------------------------------------------------------
revoke update on public.profiles from anon, authenticated;
grant  update (full_name) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- admins: membership is the whole record. Deliberately its own table with no
-- INSERT/UPDATE/DELETE policy at all, so the only way to create an admin is
-- with the service-role key or from the SQL editor. There is no path from a
-- signed-in session to becoming one.
-- ---------------------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  note       text,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- An admin may confirm they are one. Nobody can see the roster, and nobody can
-- write to it.
drop policy if exists "read own admin row" on public.admins;
create policy "read own admin row" on public.admins
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- is_admin(): the predicate every admin policy below is built on.
--
-- SECURITY DEFINER so it reads `admins` without tripping that table's own RLS,
-- which would otherwise recurse. STABLE so the planner calls it once per query
-- rather than once per row.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.admins a where a.user_id = p_user_id);
$$;

-- Policy expressions call this as the querying role, so make the grant explicit
-- rather than leaning on Postgres' default EXECUTE-to-PUBLIC.
grant execute on function public.is_admin(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin read access. Each policy is additive to the member policy already on
-- the table: members keep seeing their own rows, admins see everything.
-- ---------------------------------------------------------------------------
drop policy if exists "admins read all profiles" on public.profiles;
create policy "admins read all profiles" on public.profiles
  for select using (public.is_admin(auth.uid()));

drop policy if exists "admins read all orders" on public.orders;
create policy "admins read all orders" on public.orders
  for select using (public.is_admin(auth.uid()));

drop policy if exists "admins read all returns" on public.returns;
create policy "admins read all returns" on public.returns
  for select using (public.is_admin(auth.uid()));

drop policy if exists "admins read all ledger" on public.points_ledger;
create policy "admins read all ledger" on public.points_ledger
  for select using (public.is_admin(auth.uid()));

drop policy if exists "admins read all memberships" on public.memberships;
create policy "admins read all memberships" on public.memberships
  for select using (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- Admin write access, deliberately narrow: moving a return along its lifecycle.
--
-- 'refunded' is absent from the whitelist on purpose. Money moving is recorded
-- by the charge.refunded webhook using the service-role key, so no human can
-- mark a return refunded by hand and desync the site from Stripe.
-- ---------------------------------------------------------------------------
drop policy if exists "admins advance returns" on public.returns;
create policy "admins advance returns" on public.returns
  for update using (public.is_admin(auth.uid()))
          with check (
            public.is_admin(auth.uid())
            and status in ('approved', 'in_transit', 'received', 'rejected')
          );

-- Who moved it last, and why. `admin_note` is the rejection reason a member
-- gets told, so it is written on every transition, not just refusals.
alter table public.returns add column if not exists admin_note text;
alter table public.returns add column if not exists handled_by uuid
  references public.profiles(id) on delete set null;
alter table public.returns add column if not exists handled_at timestamptz;

create index if not exists returns_status_idx on public.returns (status, created_at);

-- ---------------------------------------------------------------------------
-- Granting the first admin. Run this once, with your own email:
--
--   insert into public.admins (user_id, note)
--   select id, 'founder' from public.profiles where email = 'you@example.com'
--   on conflict (user_id) do nothing;
--
-- To revoke:  delete from public.admins where user_id = '<uuid>';
-- ---------------------------------------------------------------------------
