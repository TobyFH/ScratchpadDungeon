# Planned reel changes and Seed death bursts

## Using the workshop

**Queue unaffordable changes** is enabled by default in the reel workshop. The
setting is remembered between runs. Affordable choices still buy immediately.
An unaffordable, legal choice has a dashed border and **Queue · cost** instead
of a purchase label. Selecting it spends nothing and leaves the current face
unchanged. **Queued** marks the planned choice and its face; a small dot marks
any reel with plans, and the workshop shows the number pending for this hero.

Each face can hold one planned rank change **or** symbol replacement. Multiple
faces, reels and heroes can have plans. Choosing another plan for the same face
replaces its previous plan. Click a queued choice again, or **Cancel plan**, to
remove it. A rank-IV plan buys the whole quoted change atomically: it does not
buy intermediate ranks early. An inscription on an empty face queues its chosen
symbol; set further ranks after the inscription has been bought.

When points become available, that hero buys the cheapest affordable plan first.
Equal-cost affordable plans are chosen randomly. Continue until nothing else is
affordable, retaining the remaining points and plans. Points are never shared
between heroes. Level-up awards, found points, personal events and edit refunds
all use the same safe save/render boundary. A roll or movement already in flight
finishes first. Actual purchases are recorded in the Event log.

Turning the toggle **off clears all heroes' plans immediately** and disables
unaffordable choices. Turning it back on does not restore cancelled plans.
Autoplay preserves points for a player's pending plans rather than spending
them on competing edits. New runs retain the setting, not the previous heroes'
plans. Existing saves need no expedition reset for these additive fields.

## Implementation contracts

- `game/reel-upgrades.js` owns prices, edit validation, paid receipts/refunds,
  and the shared `quoteFaceTier` / `setFaceTier` transaction. Rank quotes simulate
  successive existing edits on a copy, without modifying the original hero.
- `game/reel-queue.js` owns plans, validation, replacement/cancellation, shared
  symbol quotes, atomic commits and affordable purchasing. A saved `reelQueue`
  entry is `{reel,index,kind,target,expected}`; `expected` fingerprints the actual
  type, tier and paid investments. Discard stale, malformed, duplicate or
  forbidden plans before use. Never trust a saved price or replay an edit
  against a different face. Summons, class seals and mystery marks stay locked.
- `ui/icon-reel-workshop.js/.css` own the toggle, concise action labels, queue
  markers, cancel control and fixed receipt area. The retained legacy editor
  uses these same controls and transaction path.
- `save()` and `render()` settle affordable plans only when neither combat rolls
  nor travel are busy. `autoUpgradeHero()` gives user plans priority. Manual edits
  cancel the affected face's old plan; quotation copies do not cancel real plans.
- Gameplay RNG is used **only when an actual purchase needs an equal-cost tie
  broken**. Quoting, rendering, validating and waiting for points consume none.

## Blood Seeds on death

`damageEnemy()` resolves split/revival passives before checking final death.
Nonfatal damage continues to consume one Seed per actual HP lost. A genuinely
fatal hit instead detonates **all Seeds still present**, including those that
would have been consumed by that last hit. Each offers the existing detonation
amount: **2 base shared healing**, scaled once per caster-owned pool. No new
Seeds are planted, and no extra damage, Souls, kills or rewards are generated
against the already dead enemy.

`detonateDefeatedBloodSeeds()` clears the reservoir before feedback and recovery,
retains FIFO ownership credits across multiple Bloodbinders, scatters red Seed
bursts near the enemy's badge, and returns healing flights to actual recipients.
Existing feedback settling keeps the final recovery visible before victory.
Blood Bloom clears its reservoir before damage, so a killing Bloom never pays
its Seeds twice. A splitting enemy retains its surviving Seeds for its fragment.

## Checks

Run `npm run build:ui`, then `npm test` and `npm run review:ui`. Focused browser
coverage is in `tests/reel-queue.test.cjs`, `tests/icon-workshop.test.cjs`,
`tests/bloodbinder-balance.test.cjs` and `tests/bloodbinder-update.test.cjs`.
Queue tests cover actual UI clicks, toggle clearing, individual cancellation,
equal-cost random ties, point awards/refunds, autoplay priority, reloads, corrupt
entries, fixed summons, protected marks, legacy controls, and all eight classes
at desktop, Deck and 390/320px phone sizes. Seed checks include fatal physical,
poison and explosive damage, split forms, ownership, bounded overkill, no double
payout and cancellation-safe feedback without gameplay RNG.
