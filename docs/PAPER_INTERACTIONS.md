# Combat, exploration and interaction pass (save 26)

This document supersedes earlier Seed, shield cap, stimulant, trait-rate and
optional-temple examples. Edit the source modules and rebuild `index.html` with
`npm run build:ui`. The result remains a single offline HTML file.

## Stable UI and input

- Heal target hitboxes stay enabled and retain their DOM while walking. Changing
  target is allowed during travel. A Necromancer’s target has a skull border and
  “Ordinary heals fail”; selection remains possible. An explicitly selected
  immune target is not silently replaced by another ally. Ordinary full-health
  targeting still redirects a wholly wasted heal to an injured eligible ally.
- `healHero` records immunity/reduced recovery. The shared `beam` completion
  plays a small grey health glyph bouncing away after the green incoming effect.
  Recovery cannot bypass immunity, gain HP from its FX, or be paid a second time.
  The hook also supports Clotted-like reduction; the retired Bloodbinder
  Clotted mechanic is **not restored**. The fairy’s Cotton Stitches uses it.
- The artefact sheet has a width-bounded two-column scroll region, a fixed
  introduction and fixed confirmation. It does not shrink descriptions to fit an
  ever-growing collection. This is an intentional exception to the usual
  log-only scrolling rule.
- The footer switches **Hotkey controls / Focus controls**. Focus controls use
  arrows/WASD for spatial selection, Enter/Space to confirm, Escape/Backspace to
  go back, and Tab/Shift+Tab for sequential access. Native form controls keep
  their keys. Mouse movement/click clears controller-style focus immediately;
  the next navigation key restores it. This is keyboard controller rehearsal,
  not a claim of physical-controller or Steam verification.
- Hovering a floor name gives a short biome description. The guide and live
  tooltips use the same selected-target stimulant and shield vocabulary.

`ui/control-navigation.js` owns focus rehearsal. Keep action choices delegated to
existing buttons, avoiding a second set of gameplay handlers. The mouse always
works. `ui/paper-interactions.css` contains the new reusable sheet/feedback rules.

## Bloodbinder

`game/bloodbinder.js` remains authoritative.

1. Resolve all non-Seed effects on the three marks first, then plant ordinary
   Seeds. That roll’s spell hits cannot immediately consume its fresh planting.
   Nonlethal offering costs remain once per actual Seed face, before criticals.
2. One actual HP of enemy damage consumes one Seed. Seeds keep FIFO source
   receipts so one Bloodbinder cannot take another’s existing healing credit.
   Legacy `{count, sourceId}` reservoirs normalize without losing their count.
3. Scale each owner’s **one shared healing pool** by their level healing factor,
   healing equipment, healing trait, Defensive temperament, active healing
   artefact and recovery lesson once. Allocate that pool among injured eligible
   allies; never multiply it once per ally or once per allocated HP. Actual
   restoration still goes through `healHero` and spends Berserker Fury.
4. Blood Bloom first plants **2 + floor((level−1)/2)** free Seeds on each living
   enemy, then detonates every existing Seed. Each provides **2 piercing damage
   and 2 base shared healing**. HP damage is capped naturally by remaining enemy
   HP; its offered healing is not capped by enemy overkill. A critical does not
   multiply this fixed detonation a second time.
5. Small red bursts originate near the visible Seed badge. A Bloom above five
   total Seeds gets a large outgoing blood arc, explosion, and the normal return
   healing flights from victims to actual recipients. Promises settle before
   victory. Cancellation, utility suspension and reduced motion remain supported.

Seed sources contain stable hero IDs and counts, not references to DOM/entities.
No timers or expiry caps are reintroduced. Future Seed costs/bonuses belong in
`BLOOD_BINDING`, `bloomSeedsAdded` and `seedHealingOffered`, not cosmetic code.

## Protection and stimulants

- Shared party block cap: **24**, or **36** with a living Tank. Enemy shared block
  uses 24, or 36 with a boss. The blue/silver tint still saturates at 20 visually.
- Critical block: `ceil(base × (1 + .4 × (multiplier−1)))`. Other critical powers
  are unchanged. `criticalBlockGain` / `criticalEffectValue` supply the actual
  result and the critical payoff, preventing misleading displayed block totals.
- Stimulants fill at most **three recipient actions**. Every **two surplus
  doses** increase potency, capped at eight. Damage bonus is
  `1 + floor(potency/2) + max(0,potency−2)`; resistance remains
  `1 + floor(potency/5)`. Recipient-action expiry is unchanged.
- Ally stimulant always uses the **selected heal target**, including Jester
  marks and equipment procs. Attack flights with stimulant bonuses are gold
  tinted and call out their bonus, retaining ordinary damage/crit identities.
- Chainbound revenants and ash colossi break shields: **2× shield consumption**,
  ordinary HP damage. Sundering Maul equipment and Sundering Ink supply offer
  the same effect to players. Shared `damageHero`/`damageEnemy` do the calculation.

## Exploration and encounters

### Challenge temples

A temple is the **castle/keep sketch** on a small square of wall tiles, with an
opening on its **south** side and an optional elite guardian inside. The map
legend calls it Temple; hovering it calls it Challenge temple. It is distinct
from the mandatory staircase guardian. Resolve it as an encounter for stronger
spoils, or explore around it.

`WORLD_BALANCE.strongholdChance` is **.14 per attempted floor**. The unchanged
safe-placement proof can reject a site, so a floor chance does not translate
simply to ten independent draws. A seeded sample of 1,000 ten-floor sets found
**684 temple-bearing runs (68.4%)**, near the requested 70%. The sample is a
world-generation diagnostic, not a promise for a shortened player run. The
stair distance, south approach and all-tile escape checks remain mandatory.

### Bandits

Each run schedules one encounter on a random floor 2–5, and has a 65% chance of
a second on floor 6–10. It triggers on a fresh, empty passage after at least
three steps on that floor. Finding no eligible passage or leaving early can
miss it. There are never more than two. The bandits always number two: one
physical class plus another physical or utility class, never Necromancer.

Pay `35 + 22 × floor` carried gold, or fight both normal hostile class builds.
Their stats use ordinary enemy floor/pair budgets and their reels follow their
classes. A disabled payment option cannot charge unaffordable gold. Autoplay
uses the same buttons and reading holds; a badly wounded party pays if able.

### Fairy rings and shops

Fairy ring investigation has 40% prank / 15% guardian / 45% no follow-up odds.
The original chosen healing or loot still resolves. Ten pranks announce their
name and exact consequence: one lost level, short next-fight sleep, party stun,
enemy stimulant, 10% carried-gold loss, weak poison, first-roll blackout,
Vulnerable opening, enemy shared block, or halved healing. Pending receipts are
saved and consumed by the next battle opening once. Combat-only effects clear
with other battle statuses. No lost level removes paid reel faces.

Ordinary shop supplies get a modest depth promotion from floor three. Shops
have a 38% premium-stock chance, offering supplies graded three floors ahead.
Stock and premium receipts persist on the cell. Shared pricing and bag-full
confirmation remain authoritative for player and autoplay purchases.

The former Post-itler cosmetic identity is now **Sticky Bandit**, with a masked,
expressive sticky-note pencil drawing. Species IDs, stats and cry identity stay
stable. General trait occurrence drops from 30% to 16%, with an additional
30% gate for Bookish; character moments also grant traits less frequently,
especially Bookish. Reactive ally speech is infrequent, uses only FX randomness,
and respects party/individual chatter gaps.

## Quartz and other aura drawing

Hidden intact quartz affects fights and its blue field is visible even before
the deposit is revealed. `crystalFieldGeometry` generates radius-one cells from
local neighbours; combat source queries retain the same sight and wall rules.
Overlapping fields are a single fill and apply only one set of seals. Small
trails move from affected cells toward one source; source cells get a circle.
Clearing and active-lantern ranges use the same directional drawing language.
These effects use terrain-motion and reduced-motion toggles, never world RNG.

## Updates and performance

`EXPEDITION_RELEASE` is a stable build receipt. On boot, an older release ends
its current expedition and starts the normal first-boot/class-selection flow.
**Camp unlocks, banked gold, bestiary and settings are separate and preserved.**
Change this receipt deliberately for incompatible releases; do not derive it
from a timestamp or every HTML export. Same-release saves continue normally.

The targeted performance pass keeps unchanged heal targets, party and inventory
DOM; text fitting caches actual content/dimensions/font/viewport inputs. Real
writes invalidate retained panels through mutation observers. Hero hover no
longer serializes the whole party/enemy/history before checking an internal SVG
crossing. Quartz geometry iterates local neighbours rather than scanning the
whole map once per source. Particle counts, artwork and effect quality are not
reduced. Re-run the isolated profile before making hardware/FPS claims.

## Validation

Run `npm run build:ui`, `npm test`, `npm run review:ui` and
`npm run review:environment` and `npm run review:interactions`. The focused review
also exercises real automatic reading gates for bandits and fairy pranks.
`tests/paper-interactions.test.cjs` covers real
roll ordering, source credit, Bloom, rejection FX, immunity, compact collections,
hidden quartz, shield breaking, stimulant targeting, pranks, bandits, release
reset and focus/mouse switching. Existing migration/combat tests must update
numeric expectations only where these rules intentionally changed.

### Review evidence

The full notebook review produced 184 captures; the environmental review produced
36, and the focused interaction review eight. All reported zero browser errors
or external requests. The focused review includes immune targets, hidden quartz,
a Blood Bloom in flight, bandits, a prank and focus controls. Artefact collection
captures are also checked at 1920, 1280, 390 and 320 pixels; title/toolbar and
horizontal card bounds are assertions as well as visual checks.

A diagnostic 4× CPU comparison of 24 unchanged full renders against `5707b18`
measured main-thread task work at 3.285 s before / 2.893 s after, layout at
.502 s / .336 s and text-fit helper work at .495 s / .304 s. Concurrent test
activity makes this indicative, not a controlled FPS claim; repeat the profiler
on the affected player's hardware. No particles or artwork were removed.

Final validation: **654/654 tests passed** in the complete `npm test` run,
with no skipped or cancelled checks. The exact backup also completed a real
combat action with networking disabled, then restored unchanged HP and legal
reels on reload. The archive contains the same HTML bytes as the committed game.
