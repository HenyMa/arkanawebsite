# Arkana

Storefront for the Arkana clothing brand — four garments, one of each: a hoodie,
a sweatshirt, a sweatpant and a zip-up jacket. Stripe checkout with free
shipping, site search, self-service returns, and member accounts with a
points-based rewards programme (the Arkana Circle).

Built with Next.js 15 (App Router), TypeScript, Tailwind CSS v4, Supabase, and
Stripe Checkout.

---

## Prerequisites

**Node.js is not installed on this machine.** Install it once before running
anything:

- Download the macOS Apple-silicon installer from <https://nodejs.org> (take the
  LTS build), **or**
- `brew install node` if you'd rather install Homebrew first.

Dependencies are already installed in `node_modules/`, so once Node is on your
PATH you can go straight to `npm run dev`.

---

## Running it

```bash
npm install    # only needed if node_modules is missing or package.json changes
npm run dev    # http://localhost:3000
```

The site runs **without any keys**. The storefront, product pages, and cart all
work; checkout and accounts show a short "not connected yet" notice instead of
erroring. Add the keys below to switch those on.

---

## Setup

Copy `.env.local.example` to `.env.local` and fill it in as you go.

```bash
cp .env.local.example .env.local
```

### 1. Supabase — accounts and rewards

1. Create a project at <https://supabase.com>.
2. **Project Settings → API**: copy the Project URL and the `anon` public key
   into `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Copy the `service_role` key into `SUPABASE_SERVICE_ROLE_KEY`. This one is
   server-only — it bypasses row-level security and must never be exposed to the
   browser or committed.
4. **SQL Editor → New query**: paste the whole of `supabase/schema.sql` and run
   it. This creates the tables, the security policies, the sign-up trigger that
   grants the 100-point joining bonus, and the `award_points` and
   `record_refund` functions.

   > The file is idempotent — **re-run it after pulling changes**. Returns, the
   > member welcome discount, refund tracking, and paid memberships each added
   > tables or columns, and the account page will not load until they exist.
5. **Authentication → URL Configuration**: set the Site URL to your domain (or
   `http://localhost:3000` while developing) and add
   `https://yourdomain.com/auth/callback` to the redirect allow-list.

### 2. Stripe — payments

1. **Developers → API keys**: copy the secret key into `STRIPE_SECRET_KEY`.
   Use the test key (`sk_test_…`) until you're ready to take real money.
2. Install the Stripe CLI (`brew install stripe/stripe-cli/stripe`), then in a
   second terminal:

   ```bash
   npm run stripe:listen
   ```

   It prints a signing secret (`whsec_…`) — put that in
   `STRIPE_WEBHOOK_SECRET`. Leave it running while testing so orders and points
   get recorded.
3. Test card: `4242 4242 4242 4242`, any future expiry, any CVC.

There is nothing to create in the Stripe product catalogue — prices are sent
inline from `src/lib/products.ts` at checkout time.

---

## Deploying

Vercel is the path of least resistance:

1. Push this directory to a GitHub repo.
2. Import it at <https://vercel.com/new>.
3. Add every variable from `.env.local` in **Settings → Environment Variables**,
   with `NEXT_PUBLIC_SITE_URL` set to your real domain.
4. In Stripe, **Developers → Webhooks → Add endpoint**:
   `https://yourdomain.com/api/webhooks/stripe`, subscribing to
   `checkout.session.completed` **and `charge.refunded`** (the second one is
   what closes out returns and claws back points). Copy that endpoint's signing
   secret into Vercel's `STRIPE_WEBHOOK_SECRET` (it differs from the CLI one).
5. Update the Supabase Site URL and redirect allow-list to the real domain.

---

## Making it yours

| What | Where |
| --- | --- |
| Categories and their prices, products, sizes, stock | `src/lib/products.ts` |
| Product photography | `public/products/` (see below) |
| Shipping rates and countries | `src/lib/shipping.ts` |
| Carriers offered when marking an order shipped | `src/lib/orders.ts` |
| Drop-alert opt-in copy and consent wording | `src/components/SmsAlerts.tsx` |
| Points rates, tiers, joining bonus, discounts, membership prices | `src/lib/rewards.ts` |
| Return window, reasons, statuses | `src/lib/returns.ts` |
| Who is an admin | `public.admins` table (see below) |
| Search synonyms, help pages, ranking | `src/lib/search.ts` |
| Colours, fonts, spacing | `src/app/globals.css` (the `@theme` block) |
| Homepage copy and sections | `src/app/page.tsx` |
| Brand story | `src/app/about/page.tsx` |
| Shipping & returns policy text | `src/app/shipping/page.tsx` |

### Swapping in real photos

The SVGs in `public/products/` are placeholders. Drop your own images into that
folder and point `images` in `src/lib/products.ts` at them:

```ts
images: ["/products/monolith-front.jpg", "/products/monolith-back.jpg"],
```

Cards and the gallery expect a **4:5 portrait** crop. The first image is the
one shown on cards; the second cross-fades in on hover.

### Pricing

Price lives on the **category**, not the product — `CATEGORIES` in
`src/lib/products.ts`:

```ts
{ slug: "hoodies", name: "Hoodies", priceCents: 11500, … }
```

Every product in a category is stamped with that price when the catalogue is
built, so a new hoodie can't accidentally ship at the wrong number. Change one
value and the cards, product pages, cart, and Stripe line items all follow.

### Search

`/search` is a plain server-rendered page reading `?q=`, so search works with
JavaScript off and every result set has a shareable URL. The header overlay
(click Search, or press `/` or `⌘K`) is a convenience on top of it.

Ranking lives in `src/lib/search.ts` — an in-memory scored scan, no index
server. Two things worth knowing when you edit it:

- **Synonyms hang off the category.** `keywords` in `CATEGORIES` is what makes
  "joggers" find the sweatpant and "jacket" find the zip-up. Products inherit
  their category's list.
- **Help pages are indexed too.** In a shop this small, "how do returns work" is
  a more common query than any product name. Add to `PAGES` to cover more.

A category is only indexed once it holds two or more products — with one piece
in each, a category result is just a slower route to the product it contains.

### Admin (the Studio)

`/admin` is the back office: an overview of what needs a decision, the returns
queue, all orders, and the member list. It is invisible to everyone else — a
non-admin gets a 404, not a login prompt.

**Granting admin.** Edit the email in `supabase/grant-admin.sql` and run it in
the SQL editor. There is no way to do this from the app, by design: the `admins`
table has no INSERT policy, so admin can only be granted with the service-role
key. A hijacked member session cannot promote itself.

Three independent things guard the area, in increasing order of how much they
matter:

1. `app/admin/layout.tsx` calls `requireAdmin()` before any page renders.
2. Each `/api/admin/*` route re-checks — **a layout does not protect a POST**.
3. Row-level security only exposes other people's rows to `is_admin()`.

The third is the real one: forget the first two and the database still returns
nothing.

**What admins deliberately cannot do.** Mark a return refunded (only the
`charge.refunded` webhook does that, so status can never disagree with Stripe),
or edit points and lifetime spend by hand (every balance stays explainable from
the ledger). Refunds are issued in the Stripe dashboard; the webhook closes the
return out.

> **Security note.** Until this release, the `update own profile` policy let any
> signed-in member write *any* column of their own row — including `points` and
> `lifetime_spend_cents` — using only the public anon key. RLS scopes rows, not
> columns. `schema.sql` now revokes UPDATE and re-grants it on `full_name` only.
> Re-running the schema closes it. This is also why admin is a separate table
> rather than a flag on `profiles`.

### Returns

Members open returns themselves from `/account` → **Start a return**. The rules
(window length, reasons, statuses, how a discounted order is pro-rated) live in
`src/lib/returns.ts`; `/api/returns` re-decides all of them server-side.

The studio side is deliberately manual for now: move a return through
`approved` → `in_transit` → `received` in the Supabase table editor, then issue
the refund from the Stripe dashboard. The `charge.refunded` webhook does the
rest — marks the return refunded, records the amount on the order, and reverses
the pro-rated points. Nothing marks money as returned except Stripe telling us
it was.

### Changing rewards rules

Everything lives in `src/lib/rewards.ts` — points per dollar, the tier
thresholds and multipliers, the redemption rate, both one-time discounts, and
what Adept and Oracle cost to buy. The marketing copy on `/rewards` reads from
those same constants, so it can't drift out of sync.

There are two automatic discounts, and both are one-time:

| Order | Rate | Burn flag on `profiles` |
| --- | --- | --- |
| First as a member | `WELCOME_DISCOUNT_PERCENT` (20%) | `welcome_discount_used_at` |
| Second, below Adept | `SECOND_ORDER_DISCOUNT_PERCENT` (10%) | `second_order_discount_used_at` |
| Second, Adept or Oracle | `TIER_SECOND_ORDER_DISCOUNT_PERCENT` (20%) | `second_order_discount_used_at` |

They never compete: one is offered only to an account with no orders and the
other only to one with exactly one, so they're mutually exclusive by
construction — which suits Stripe Checkout's one-coupon-per-session limit. Each
is gated on both the order count *and* its own flag, and the flag is set only by
the webhook once payment clears. An abandoned checkout therefore leaves the perk
intact, and an order that went through without its coupon doesn't consume it.

Which rate a member gets on their second order follows `standingCents()`, so a
bought Adept and a spent-into Adept are treated identically.

Three values are duplicated outside `rewards.ts`, each because something other
than app code needs them:

- the 100-point joining bonus, in the `handle_new_user()` trigger
  (`supabase/schema.sql`) — the database grants it;
- the tier names, in `tier_rank()` and the `check` constraints in the same file
  — the database enforces that a membership can only ever move someone up;
- every discount rate, in its Stripe coupon id (`arkana-welcome-20`,
  `arkana-second-order-10pct`, `arkana-second-order-20pct`). A coupon's rate is
  fixed when Stripe creates it, so changing a constant means changing the
  coupon id in `src/lib/stripe.ts` too — otherwise the site advertises one
  figure and Stripe takes off another.

### Tiers you can buy

Adept and Oracle can be reached by spending or bought outright for a single
payment that never expires (`POST /api/membership/checkout`). Both routes end
in the same place: `standingCents()` takes the higher of lifetime spend and any
bought tier, and everything downstream — points multiplier, return window,
free express shipping, the flat discount — reads that one number, so a bought
tier is honoured exactly like an earned one.

The tier is granted by the `checkout.session.completed` webhook via
`grant_membership()`, which is idempotent on the Stripe session id and refuses
to downgrade. Memberships are recorded in their own table rather than `orders`:
they have no items, earn no points, move no lifetime spend, and can't be
returned.

Adept and Oracle also get the higher rate on their second-order discount — see
the table above.

### Packing and shipping

Stripe collects and validates the shipping address at checkout, and the
`checkout.session.completed` webhook stores it on `orders.shipping`. `/admin/orders`
is the queue: it opens on **To pack** (anything with `fulfilled_at` null,
oldest first) and shows each order's line items with sizes next to the address
to write on the label. Marking one shipped records the carrier and tracking
number, which then appear on the member's account page as a tracking link.

Fulfilment is deliberately a separate axis from `orders.status`, which tracks
money and is written only by the webhook — a refunded order may well have
shipped, and a paid one may not have.

Admins can write `fulfilled_at`, `tracking_carrier` and `tracking_number` and
nothing else: the RLS policy says *who*, and a column-level grant says *what*,
the same pairing used on `profiles`. The money columns stay writable only by the
service role.

Buying and printing the labels themselves is still manual, and nothing emails
the tracking number out — `/shipping` promises that it does, so that copy is
ahead of the code.

### Drop alerts (SMS)

`/admin/drops` writes a message, picks an audience, and sends. Two audiences:
**every member** who has opted in, and **Adept & Oracle** for the exclusive
early look. "Paid" means standing, so a bought tier and a spent-into tier both
count — the same rule the discounts use.

Runs on Twilio, over `fetch` rather than the SDK (`src/lib/sms.ts`); the pure
helpers live in `src/lib/sms-format.ts` so Client Components can count message
segments without pulling `node:crypto` into the bundle. All four `TWILIO_*` vars
are optional: without them the feature switches off cleanly rather than
half-working.

**Consent is the load-bearing part.** US marketing SMS needs prior express
written consent, and if it is challenged the burden of proof is on you. So:

- a number is only reachable after a **one-time code** proves it belongs to the
  person entering it — this is also what stops a mistyped digit texting an
  uninvolved stranger for months;
- consent is stored as *when, from where, and to which number*, not a boolean,
  and every change is additionally appended to `sms_consent_log`, which has no
  UPDATE or DELETE policy for anyone;
- **STOP is wired from day one.** Twilio and the carriers honour it before our
  code runs; `/api/webhooks/twilio` keeps our copy of that state honest so an
  opted-out number is never queued again. The signature is verified — without
  that check, anyone who learned the URL could unsubscribe an arbitrary number;
- nothing in the studio can add someone to the list. Every write goes through
  the service-role key, and `profiles` grants `authenticated` update on
  `full_name` alone, so a member can't mark their own number verified either.

Members opt in from `/account`, from the welcome prompt after signing up
(`/account?welcome=1`), and from `/success` after an order. Stripe collects a
phone number at checkout for the carrier — that is **not** reused as consent and
is never copied into `profiles.phone`.

Sending is split in two on purpose. `POST /api/admin/sms` snapshots the
recipients into `sms_deliveries` and sends nothing; `POST /api/admin/sms/send`
works through them 25 at a time, and the composer calls it until the queue is
empty. That is what makes a send survive a serverless timeout: the recipient
list is durable, each row is claimed before its message goes out, and
`unique (broadcast_id, user_id)` means resuming can't text anyone twice. The
worst case is someone misses a drop, never that they get it twice.

Before any of this reaches a real handset you need **A2P 10DLC brand and
campaign registration** in the Twilio console. Unregistered traffic gets
filtered or blocked by the carriers, and approval takes days to weeks. Nothing
in the code can shortcut that.

---

## How it fits together

```
Browser                      Server                        Stripe / Supabase
───────────────────────────────────────────────────────────────────────────
cart (localStorage)
  └─ POST /api/checkout ───▶ re-prices from the catalogue
                             looks up the member's tier
                             builds shipping options ─────▶ Checkout Session
  ◀── redirect to Stripe ────────────────────────────────────────┘

                                          customer pays on Stripe's page
                                                                 │
                             POST /api/webhooks/stripe ◀─────────┘
                             verify signature
                             insert order (idempotent)
                             award_points() ────────────────────▶ Supabase
  ◀── /success (clears cart)


/account
  └─ POST /api/returns ────▶ re-checks ownership, window,
                             quantities still returnable
                             prices the refund ──────────────────▶ returns row
  ◀── RMA reference

                                          studio refunds in Stripe
                                                                 │
                             POST /api/webhooks/stripe ◀─────────┘
                             charge.refunded
                             record_refund() ───────────────────▶ Supabase
                               · marks the return refunded
                               · records the amount on the order
                               · reverses pro-rated points
```

Three deliberate choices worth knowing about:

- **Prices are never trusted from the browser.** `/api/checkout` accepts only a
  slug, size, and quantity; it looks up the price server-side and rejects
  anything unknown or out of stock.
- **Points are only ever minted by the webhook**, using the service-role key.
  There is no INSERT policy on `orders` or `points_ledger`, so a member can't
  write themselves a balance. The order insert is idempotent on
  `stripe_session_id`, so Stripe's retries can't double-credit anyone.
- **Nothing is marked refunded until Stripe says so.** A member can open and
  cancel a return, and the studio can move it along, but only the
  `charge.refunded` webhook writes money back. It works off the charge's
  *cumulative* `amount_refunded`, so redelivered events are no-ops and split
  refunds still add up.

---

## Not built yet

Deliberately out of scope for this first pass — all straightforward additions
when you want them:

- **Redeeming points at checkout.** Balances accrue and display correctly, but
  there's no "spend 500 points" control yet. It would attach a Stripe coupon to
  the session and write a negative ledger row.
- **Search across order history.** Site search covers the catalogue and help
  pages, not a member's own orders.
- **Real inventory.** Stock is the `inStock` array per product, edited by hand;
  nothing decrements on purchase or prevents overselling.
- **Transactional email** beyond Stripe's own receipt. Notably, nothing emails
  a member their tracking number once you mark an order shipped — you record it
  in the studio and they see it on their account page, but the "we'll email you
  tracking" line on `/shipping` isn't true yet.
- **Buying shipping labels.** `/admin/orders` gives you the pack list and the
  address; you still buy and print the label yourself and paste the tracking
  number back in.
