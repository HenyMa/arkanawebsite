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
thresholds and multipliers, the redemption rate, the flat member discount, and
what Adept and Oracle cost to buy. The marketing copy on `/rewards` reads from
those same constants, so it can't drift out of sync.

Three values are duplicated outside that file, each because something other
than app code needs them:

- the 100-point joining bonus, in the `handle_new_user()` trigger
  (`supabase/schema.sql`) — the database grants it;
- the tier names, in `tier_rank()` and the `check` constraints in the same file
  — the database enforces that a membership can only ever move someone up;
- `MEMBER_DISCOUNT_PERCENT`, in the Stripe coupon `arkana-member-10pct`. A
  coupon's rate is fixed when Stripe creates it, so changing the constant means
  changing the coupon id in `src/lib/stripe.ts` too — otherwise the site
  advertises one figure and Stripe takes off another.

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

Adept and Oracle also get a percentage off **every** order. It competes with the
20% welcome discount rather than stacking — Stripe Checkout takes one coupon per
session — and the larger of the two wins, compared in cents. At the current
rates the welcome discount always takes a member's first order and the member
discount every order after. If the welcome discount loses it isn't burned, so it
survives for next time.

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
- **Transactional email** beyond Stripe's own receipt, and shipping labels,
  which you buy manually from the order details.
