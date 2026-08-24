# Tech-Powered Differentiation — Reference

A running list of ways this business can use the fact that it's being built by someone who can
actually write software, not just run a fruit stand. Grouped by status so it's clear what's real
versus what's still an idea. Every "shipped" item ties back to data the app already computes —
none of this is speculative infrastructure, it's mostly *surfacing* things that already exist
internally.

---

## Shipped

- **Value transparency (`/boxes`)** — every box shows per-item weight in kg and total $/kg, not
  just product names. Nobody in the local competitor set (Flannery's, Ambarella, Awesome
  Organics/the Sunday market, or any of the nine regional box businesses researched) publishes
  this. Built off `lib/boxes/calc.ts`, data that already existed for cost purposes.
- **Curated swap pools** — box items can carry a small, admin-picked set of substitutes (not
  "anything on the wholesale list"), so "I don't use much parsley" has an answer without breaking
  the pack-rounding procurement math. Customer picks a swap on `/boxes`; price doesn't move.
  (`lib/boxes/types.ts`, `components/boxes/box-card.tsx`)
- **Box reservation capture** — a swap choice is pointless if it goes nowhere. `/boxes` → "Reserve
  this box" → `/admin/box-orders`, server-validated (a swap outside the curated pool is silently
  rejected, price is never trusted from the client). Not a paid order yet, but a real request the
  business can act on. (`lib/box-orders/`, `app/api/box-orders/`)
- **Real vehicle data replacing guesses** — the Business Model tool's fuel-consumption assumption
  now reflects the actual Renault Master (8.6 L/100km, highway-weighted blend of real 9 urban /
  8.5 highway figures) instead of a generic van placeholder.

---

## Immediate — the heat problem

Confirmed as the first move: **insulate and cool the garage itself**, not the distribution model.
Cheapest fix aimed directly at the actual mechanism (time × temperature exposure):

- Insulated crates/eskies + ice bricks or gel packs for whatever's staged during a pickup window.
- Shade, ventilation, or a portable AC/fan just for pickup hours — doesn't need to condition the
  whole garage all day, just the exposure window.
- Tighter pickup windows on hot days rather than one long all-day slot, so nothing sits out for
  six-plus hours.

**A genuinely tech-flavoured add-on, cheap and currently uncontested:** a $20–40 Bluetooth/WiFi
temperature-and-humidity logger in the garage during pickup hours, with the log surfaced to
customers — "cold chain, shown not claimed." Same instinct as the $/kg transparency play: nobody
else in the local set publishes anything like this, and it's a trust signal that costs almost
nothing to build given the skill already in the room.

---

## Near-term, cheap, high-leverage

Small builds against data or logic that already exists — no new modelling required.

| Idea | What it needs | Why it's cheap |
|---|---|---|
| Price-comparison line on `/boxes` | Text pulled from `doc/research-competitor-produce-boxes.md` findings | The research already exists; this is just putting it where a customer decides |
| Pickup slot/window booking | A simple calendar/slot UI | Directly answers the market-rigidity finding (fixed 6–11:30am Sunday, no other way to reach the closest competitor) |
| Saved exclusion-list preferences | A customer profile field, applied automatically each week | Cheaper than live substitution logic; matches the "no lock-in" pattern behind the two most durable competitors found (FreshBox, Ripe n Raw) |
| SMS/WhatsApp pickup reminder + confirmation | A transactional SMS API (e.g. Twilio) | Cuts no-shows, which matter more for a pickup-only, perishable business than most |
| Leftover/same-day clearance flag | Reuses `priceForMargin`'s existing negative-margin support | The pricing math for below-cost clearance was already built for the subsidy strategy — this just needs a UI surface and a same-day nudge |

---

## Bigger bets — pilot small, don't commit yet

Both aimed at the same heat/rigidity problem, but structurally different businesses. Don't do
both, and don't scale either past a pilot before real signal exists.

- **Short local delivery round (Renault Master).** Not the same economics as the long-haul
  delivery already ruled out (eco-farms' tiered fees, the Farm Gate Express precedent) — those
  were 50–100km+ runs. A tight-radius round inside the immediate Varsity Lakes cluster is a
  different cost shape (no fuel levy, high stop density if customers cluster, short total drive
  time). It's also the one that reintroduces the "syncing" problem — every stop needs a rough
  window and a sequence, and it doesn't scale past what one driver can cover in a heat-safe
  timeframe. Pilot with one tight-radius day and a handful of customers before treating it as a
  standing schedule.
- **Air-conditioned community hall as a pickup point.** Solves the heat problem with zero routing
  complexity — it's still an appointment, just a cooler one. Same shape as the rotating pop-up
  idea already scoped, now justified by heat-safety rather than reach. Real recurring cost (hall
  hire — already has a home as `weeklyFixedCosts` in the Business Model tool), no scheduling
  complexity added.
- **Full customer portal** — pause/skip/cancel a subscription, manage saved exclusions, see order
  history. The natural next step after the exclusion-list MVP above, once there's enough
  recurring-customer volume to justify it.
- **Wire boxes into the storefront that already exists.** This repo is a Next.js
  Commerce/Shopify-Hydrogen starter (`app/product/`, `app/search/`, `lib/shopify/`, cart/checkout
  mutations) — currently dormant, Shopify retrieval disabled on the homepage. Real payment/
  checkout for box reservations is a matter of reconnecting that, not building commerce
  infrastructure from scratch.

---

## Internal-only leverage (not customer-facing, still a real edge)

- **Pack-rounding procurement math** (`lib/boxes/procurement.ts`) — buys exactly what's needed in
  whole packs (or takes eco-farms' 20% split-pack fee when that's cheaper), rather than eyeballing
  an order like a manual operator would. Tighter margins than competitors who don't do this,
  quietly, every week.
- **JSON-file persistence, no DB** — keeps infrastructure cost at effectively zero at this scale,
  and every entity (boxes, pricing, orders, the business model itself) is easy for a technical
  solo operator to extend without provisioning anything. Not a customer-facing differentiator, but
  it's why every other item on this list is cheap to build at all.
