# Tech Differentiators — Customer-Facing Ideas

A reference list of things this business can offer customers **because it's being built by someone
who writes software**, aimed squarely at a local competitive set that isn't tech savvy at all.

The test every idea on this page has to pass: **why can't a market stall or a grocery shop just copy
this?** If Flannery's could match it by putting up a sign, it isn't a differentiator and it doesn't
belong here.

---

## Why the competition structurally can't follow

From `doc/research-competitor-produce-boxes.md`:

- **Awesome Organics** — the main organic stall at the Gold Coast Organic Farmers Market, and the
  closest direct competitor. Sunday only, 6:00–11:30am, and no website, shopfront, or other trading
  day findable anywhere. Reachable 5.5 hours a week, through one channel.
- **Flannery's / Ambarella** — daily walk-in shops, browse-and-choose, both carrying a public review
  record of "pricier than expected."
- **None of the nine regional box businesses surveyed** publish a $/kg figure or a box weight.

Nobody in that set can personalise, remember, notify, recompute, or explain anything. That's the
whole opening.

## The two assets that make these ideas possible

1. **Both sides of the price equation, as structured data.** `data/vendor-pricing/eco-farms/` holds
   what produce actually costs wholesale, normalised to $/kg. `data/retail-pricing/merrimac/` holds
   the main competitor's own board, normalised the same way. _Nobody else in this market has their
   competitor's price list as queryable data._
2. **Procurement math that surfaces things the business itself couldn't otherwise see.**
   `lib/boxes/procurement.ts` computes real pack-rounding surplus (`surplusKg`);
   `lib/margins/calc.ts`'s `priceForMargin` already handles negative margins, so deliberate
   below-cost pricing is already expressible.

---

## Prove the value

Against the "I know the products, not the kg — I don't know what this box is actually worth" problem.

**"Same basket elsewhere" comparison.** For any box, compute what the identical produce would cost
at Awesome Organics' own board prices. "This box: $46. The same 6.8kg at the Sunday market's own
prices: $61."
→ _They can't copy it: it requires holding a competitor's price list as data and recomputing it per
box. We'd be quoting their published prices back at them, accurately._

**Seasonal price intelligence.** Dated wholesale imports accumulate into real price history per
product. "Oranges are 40% down on June — that's why there are more in this week's box." Turns box
composition from arbitrary into explained.
→ _A stall knows this week's price. Only accumulated data knows the trend._

**The honest margin page.** What we paid, what we charge, why. Radical transparency as a brand
position — backed by live numbers that update themselves, not a claim on a chalkboard.
→ _Any shop could claim fairness. Almost none would show the arithmetic, and none could keep it
current automatically._

**QR code on the box → full provenance.** Scan it: contents, exact weights, $/kg, what you'd have
paid elsewhere, when it was packed, how cold it's been.
→ _The physical box becomes a pointer into everything above. A cardboard box from a stall is just a
cardboard box._

## Bend pickup around the customer

Against the rigidity that makes the Sunday market annoying — you go at their time or not at all.

**"Your box is packed — come anytime today" live status.** The market is a fixed 5.5-hour
appointment. This is its exact inverse: a flexible window, with live status telling you when it's
actually ready.
→ _Structurally impossible for a stall. Their availability window IS their business model._

**Self-service slot picking with live capacity.** Choose your window, see what's left, change it
without phoning anyone.

**Cold-chain receipt.** A temperature log from pack time to handover, shown to the customer. "Held
at 6°C since 5:40am." Proof rather than "we keep it fresh" — and a direct answer to the QLD heat
problem that every local competitor also has but none of them talk about.
→ _Nobody in this category publishes anything like this. It costs almost nothing to capture and is
very hard to counter without the same instrumentation._

## Make the box actually theirs

Against "I don't use so much parsley" — the thing that quietly kills box subscriptions.

**Build-your-own from a curated weekly pool.** Live $/kg and a running total as you assemble it.
Feels like total freedom to the customer; stays inside a pool that keeps pack-rounding predictable.
→ _A stall can let you pick items. It can't hold a per-customer composition and reprice it live._

**A never-send list that learns.** "You've swapped beetroot out three times — want us to stop
including it?" Set once, applied forever.
→ _Software remembers every customer perfectly. A shopkeeper remembers their regulars, at best._

**Household calibration.** "2 adults, 2 kids, we cook 5 nights a week" → the right box size and mix,
instead of guessing between Small and Medium and getting it wrong twice.

**Budget-led standing order.** "Keep me at about $50 a week, fill it with whatever's best value."
An algorithm re-optimising composition against live wholesale prices, every week, per customer.
→ _This is the clearest example of the whole page: no shopkeeper can do this for every customer
every week. It's only possible as software._

## Stop the churn

The stated problem: _box schemes get used a couple of times and then abandoned._ Retention is the
thing to design against, not acquisition.

**Per-item feedback loop.** One tap per item: loved it / too much / never again. Next week's box
responds. Every box gets measurably better fitted to that household.
→ _This is the direct fix for the abandonment pattern, and it compounds — the longer someone stays,
the better their box gets, the less reason to leave._

**Recipes generated from actual box contents.** We know it's 1kg zucchini, 600g tomato, 500g onion —
not "some vegetables." "I didn't use it all, so I stopped ordering" is the number one churn reason,
and it's solvable with data already held per box.

**Use-by ordering nudges.** "Your leafy greens go first — use those by Wednesday, the root veg will
keep two weeks." Turns a spoilage complaint into a service.

**Accumulated savings dashboard.** "This year: $340 saved versus shop prices, 47kg of organic
produce, 12 boxes." Retention through visible, compounding, personally-attributed value.
→ _Requires holding both the customer's history and competitor pricing. Nobody local has either._

## Turn waste into a weapon

**The surplus board.** Pack-rounding _already computes_ leftover kg — buy a 10kg pack to satisfy 7kg
of demand and 3kg is surplus (`surplusKg` in `lib/boxes/procurement.ts`). Right now that surplus is
absorbed silently into box cost, and in a Queensland summer it's also a spoilage clock ticking.

Published live as an at-cost, first-come board — with a notification to whoever wants one — it
becomes three things at once: **revenue from what was waste, a low-risk first purchase for new
customers, and heat-risk mitigation.** `priceForMargin` already supports negative margins, so
deliberately pricing at or below cost is already expressible.

→ _Probably the strongest idea here. It's uniquely enabled by machinery that already exists, and a
stall genuinely does not know what its own surplus is — let alone have a way to broadcast it the
moment it appears._

## Grow it

**Neighbourhood pooling.** "Four more Varsity Lakes orders this week unlocks a bigger pack size —
cheaper for all of you." Turns the procurement engine into a local growth loop, where customers have
a real financial reason to recruit their neighbours.
→ _Requires knowing pack-size economics per product and aggregating demand in real time. Nothing
about a stall supports this._

**Demand-led pop-up locations.** Let people register interest in where the van goes next, so a hall
booking follows measured demand rather than a hunch — and so the first pop-up at a new location
already has customers waiting when it opens.

---

## Already shipped

Small, but each one is already something the local competition doesn't do:

- **Value transparency** (`/boxes`) — every box shows per-item weight and total $/kg. None of the
  nine box businesses or three local shops surveyed publish either.
- **Curated swap pools** — box items carry admin-picked substitutes, so "I don't use parsley" has an
  answer that doesn't break procurement.
- **Reservation capture** — pick swaps, reserve a box, land in `/admin/box-orders`, server-validated.

## Appendix — internal advantages (not customer-facing)

Worth knowing about, but nothing a customer sees:

- **Pack-rounding procurement** (`lib/boxes/procurement.ts`) — buys in whole packs, or takes
  eco-farms' 20% split fee when that's cheaper. Quietly tighter margins than eyeballing an order.
- **The Business Model tool** — real transport/labour/break-even modelling with actual rate cards.
- **JSON-file persistence, no database** — near-zero infrastructure cost at this scale, and why
  everything above is cheap to build at all.
- **Insulating and cooling the garage** is the agreed first physical step on the heat problem —
  ahead of any delivery round or hall hire.

---

<sub>One note deliberately left unexpanded, so it isn't lost: `/admin` and every API route are
currently open to anyone who guesses the URL (including customer names and contacts), and the
`data/*.json` write paths won't persist on Vercel's read-only filesystem. Both matter before
anything customer-facing goes live for real — but neither is an idea problem.</sub>
