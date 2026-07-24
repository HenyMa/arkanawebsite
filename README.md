# Arkana

Storefront for the Arkana clothing brand — a hoodies collection, Stripe
checkout with flat-rate shipping, and member accounts with a points-based
rewards programme (the Arkana Circle).

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
   grants the 100-point joining bonus, and the `award_points` function.
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
   `checkout.session.completed`. Copy that endpoint's signing secret into
   Vercel's `STRIPE_WEBHOOK_SECRET` (it differs from the CLI one).
5. Update the Supabase Site URL and redirect allow-list to the real domain.

---

## Making it yours

| What | Where |
| --- | --- |
| Products, prices, sizes, stock | `src/lib/products.ts` |
| Product photography | `public/products/` (see below) |
| Shipping rates, free-shipping threshold, countries | `src/lib/shipping.ts` |
| Points rates, tiers, joining bonus, redemption | `src/lib/rewards.ts` |
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

### Changing rewards rules

Everything lives in `src/lib/rewards.ts` — points per dollar, the tier
thresholds and multipliers, and the redemption rate. The marketing copy on
`/rewards` reads from those same constants, so it can't drift out of sync.

One value is duplicated: the 100-point joining bonus also appears in the
`handle_new_user()` trigger in `supabase/schema.sql`, because it's granted by
the database. If you change it, change it in both places.

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
```

Two deliberate choices worth knowing about:

- **Prices are never trusted from the browser.** `/api/checkout` accepts only a
  slug, size, and quantity; it looks up the price server-side and rejects
  anything unknown or out of stock.
- **Points are only ever minted by the webhook**, using the service-role key.
  There is no INSERT policy on `orders` or `points_ledger`, so a member can't
  write themselves a balance. The order insert is idempotent on
  `stripe_session_id`, so Stripe's retries can't double-credit anyone.

---

## Not built yet

Deliberately out of scope for this first pass — all straightforward additions
when you want them:

- **Redeeming points at checkout.** Balances accrue and display correctly, but
  there's no "spend 500 points" control yet. It would attach a Stripe coupon to
  the session and write a negative ledger row.
- **Refund handling.** The `/rewards` FAQ says points are deducted on refund;
  that needs a `charge.refunded` webhook handler to actually happen.
- **Real inventory.** Stock is the `inStock` array per product, edited by hand;
  nothing decrements on purchase or prevents overselling.
- **Transactional email** beyond Stripe's own receipt, and shipping labels,
  which you buy manually from the order details.
