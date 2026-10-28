# Bounded combat resources and complementary builds

> Current follow-up: [Curve and recovery tuning](CURVE_TUNING.md) supersedes
> earlier numeric examples for enemies, recovery, traits, biomes and nests.

This document describes the current combat rules. It supersedes older paid
weighting, boosted/free Punchline, unlimited-block, Fury and stun examples in
previous update notes. Physical/spell rank values, critical matching and class
critical pools from [Balance pass](BALANCE_PASS.md) remain unchanged. Art,
textures, enemy floor budgets, camp lesson prices and ownership are unchanged.

## Wounds and recovery: Berserker

- An actual HP wound earns **1 Fury per HP**. Damage absorbed by block earns none.
- Blood Price still pays **2/4/6/8 HP** at ranks I–IV and cannot kill its caster.
  Each actual HP paid earns **2.5/3/3.5/4 Fury**, rounded up per landed mark.
- Matching Blood Price criticals multiply the Fury actually earned from those
  wounds, once. They never multiply the HP cost or create Fury when no HP was
  paid. A completely empty effect skips the critical presentation.
- **Every HP actually restored spends 1 Fury.** This includes lifesteal, normal
  rolls, Bloodrush, allies, supplies, fountains, revival and level-up recovery.
  Overhealing spends nothing. All ordinary healing shares `healHero`; the two
  direct HP restoration paths also use `spendFuryOnHealing`.
- Bloodrush heals its caster and adds 2 physical damage. It no longer creates
  free Fury. The order remains damage, returning lifesteal, then rolled healing.
- Capacity remains `24 + 3 × (level − 1)`. Every 4 Fury gives 1 bonus damage and
  4.5 percentage points of lifesteal, subject to the existing level-scaled limit.
  Wounds feed the burst; healing keeps the hero alive while using that charge.

`battle-tactics.js` owns Fury gain/spending and returning lifesteal. Never deduct
Fury a second time inside an individual healing effect.

## Punchline is a burst: Jester

Trick still adds its rank to anticipation. At **6**, one burst fires **six random
ordinary marks from the actual reels**, in reel order 1, 2, 3, 1, 2, 3. Each draw
uses that reel's ordinary faces with replacement, retaining the current rank.
The permanent class face is excluded; a class-only or sealed reel yields Empty.
Temporary gilding and remaining blackout/crystal locks are respected.

- Damaging marks choose living enemies; rank III/IV retains area damage.
- Healing picks the most wounded living ally by health ratio. Block adds to the
  shared capped pool. Poison, stun and ally stimulant use their shared rules.
- Trick/Empty still fly and show feedback but do not recharge anticipation.
- The burst does not roll the machine again, award another turn, roll criticals,
  trigger Wildcard or repeat once-per-roll equipment procs. Mark-specific gear,
  camp bonuses and ordinary combat effects still use `planHeroRoll`.
- Excess anticipation carries up to 5. At most one burst occurs per ordinary
  action. Enemy clocks advance once after that action, including its burst.
- A burst stops if its caster dies, the run changes or no living enemies remain.
  Combat poison cannot tick after the final opponent falls.

`game/jester.js` owns the burst. `state.lastPunchline` records its individual
marks, ranks, recipients and actual damage/healing/block for diagnosis. Existing
icon/beam/both preferences, pace, shake and reduced-motion controls still apply.

## Stun has an end on both sides

Stun can deny **at most one attempted action**. Attempting to act while stunned
misses that go and guarantees recovery. In version 22, a stunned hero is
unavailable while a ready ally can act. If every eligible hero is stunned, an
automatic missed turn advances enemy countdowns once without counting as a spin.
See [Combat clarity](CLARITY_UPDATE.md) for locks, targeting and recovery. Background recovery after real combat rolls
has a 60% chance on its first check and is guaranteed on its second.

Recovery or a successful healing cleanse grants **Steady** for **two own
completed actions**. During this protection, further stuns cannot stun the
entity. A multi-strike enemy consumes one protection action per complete turn,
not one per strike. Skipping a stunned go grants protection without consuming it.
A newly granted ward is not consumed by the action that granted it.

Repeated applications never reset a current stun's age/duration. Higher stun
power still strips more block. A protected target may still lose block or become
Vulnerable; excess stun power does not bypass Steady. Hover the shield badge for
its remaining protection. Ward/age survive an ongoing save and clear at battle
end. `battle-tactics.js` owns these rules for allies and enemies alike.

## Protection and stimulant limits

| Resource | Limit | Notes |
| --- | ---: | --- |
| Party block | 20 | Shared and consumed by damage; resets after battle |
| Party block with a living Tank | 30 | More Tanks do not stack the cap; losing the Tank lowers it |
| Enemy block | 20 | One shared pool in a paired encounter |
| Enemy block with a living boss | 30 | The same cap applies to all sources |
| Stimulant potency | 6 | Self/ally stimulant still lasts at most 3 own actions |

Block labels show the cap. Its blue-silver tint still saturates visually at 20;
that colour threshold is separate from the Tank/boss numeric cap. All block
sources use `gainPartyBlock`/`setEnemyBlock`, and ongoing saved pools clamp to
current living-party limits.

Tank Shield Bash first raises block by `2 + floor((level − 1)/3)`, then **spends**
protection to strike. Its base budget is `6 + (level − 1)`, bounded by the actual
block available after this roll's additions. Critical multiplication occurs
once, then actual spending is bounded again by available protection. Each bash
point strips 2 enemy block; only remaining attack power reaches HP. This gives
shields offensive use without preserving a permanent damaging reserve.

Stimulant overflow still adds potency, but stops at 6: at most +3 damage and +2
resistance from this effect. New and loaded buffs follow the same limit.

## A reason to mix marks

These small **same-roll** bonuses reward complementary marks. They do not alter
the matching type-and-rank critical rule. Matching damage builds remain valid,
especially for Rogue; solo heroes retain their editable offensive marks.

| Class | Complementary marks | Bonus |
| --- | --- | --- |
| Tank | Physical + block | +2 team block |
| Rogue | Physical + poison or stun | +1 physical damage |
| Mage | Spell/poison + healing/block/ally stimulant | +1 spell; +1 rolled healing, otherwise +1 rolled block |
| Ranger | Physical + healing/stun/ally stimulant | +2 physical damage |
| Berserker | Physical + healing/Blood Price | +1 physical damage |
| Jester | Trick + another useful ordinary kind | +1 anticipation |

The class mark and Empty do not count as complementary ordinary kinds. Bonuses
are stated in the workshop footer, combat hover and the guide's Mixed builds
page. `CLASS_COMBOS`/`complementaryEffects` are the authority; AI's exact
`expectedComplementaryEffects` is checked against exhaustive three-reel draws.

Autoplay still pays the same edit prices as the player. Its scoring respects
remaining block room, avoids valuing warded enemies as fresh stun targets, and
limits recovery-face density on physical classes so camp recovery cannot turn
Rogues into mostly-heal wheels. Minimum solo offence and class-specific build
preferences remain. These are AI preferences, never player edit restrictions.

## Equal faces, compatible saves

Buying weighting is removed from manual and automatic editing. Power/Replace
remain, with existing upgrade/downgrade refunds and the permanent middle seal.
The exact critical-odds page still works; duplicate faces combine their chances.

`retireReelWeights` sets every saved hero face to weight 1 and refunds paid
weighting in **personal reel points**, not gold:

| Saved weight | Ordinary refund | Class-face refund |
| --- | ---: | ---: |
| 2 | 4 | 6 |
| 3 | 12 | 18 |
| 4 | 24 | 36 |

Resetting the face makes migration idempotent; a cumulative
`retiredWeightRefund` receipt records the refund. Pre-version-18 authored
weights are removed by the existing older migration first and do not invent
refunds. Ranks, type edits, seal placement, rank-investment receipts, camp gold,
ownership and settings are preserved. Existing schema-21 saves remain readable.
Fixed event, enemy and Flurry probability distributions are unaffected: removal
of **purchasable hero weighting** does not make every world event equally likely.

## Sources and verification

- `game/balance.js`: resource caps, Bash budget, combinations, weight retirement.
- `game/battle-tactics.js`: wounds/healing Fury, stun/Steady, stimulant cap.
- `game/jester.js`: six-mark burst and temporary reel effects.
- `game/hero-builds.js`: hero/load normalization, shared enemy block and ability text.
- `game/reel-upgrades.js`: validated edits and equal-face workshop.
- `game/auto-builds.js`: class build preferences and healing density limits.
- `ui/field-guide.js`: concise current player explanations.
- `index.html`: existing action sequencing, heal/damage application and AI estimates.

Run `npm run build:ui`, `npm test`, `npm run review:ui` and
`BALANCE_RUNS=24 npm run audit:balance`. `tests/identity-update.test.cjs` exercises
actual browser rolls, wound/overheal accounting, spent Bash, shared caps, both
sides of stun recovery, enemy multi-turn wards, real burst recipients, save
refunds and exact combo expectations. Existing movement, death, items, campaign,
audio, art and compact-layout regressions remain part of the full suite.

The seeded audit suppresses presentation and uses fixed recruits/wells with no
items, shops, equipment or artefacts. Its results diagnose resource/AI problems;
they are not estimates of human campaign win rates. See the recorded report and
validation notes below for this revision's measured results.

### Recorded controlled audit

[COMBAT_IDENTITY_AUDIT.json](COMBAT_IDENTITY_AUDIT.json) records 24 identical
numeric seeds per camp configuration, alternating starter classes and
Aggressive/Defensive. The intermediate setup uses 20 of the 40 lesson ranks;
it does not mean half the total gold cost.

| Active camp configuration | Gauntlets cleared | Mean final floor reached | Safety-limit stalls |
| --- | ---: | ---: | ---: |
| No lessons | 0/24 | 5.67 | 1 |
| Alternating ranks II/III | 1/24 | 8.13 | 0 |
| All rank V | 9/24 | 9.50 | 0 |

This intentionally sparse gauntlet remains harsh and excludes most player loot
and choices. It shows a progression advantage and catches unhealthy automated
build loops, not a calibrated campaign completion percentage. One fresh-run
solo support survivor hit the finite safety limit; the audit reports that case
rather than calling it a win. A first trial exposed overly heal-heavy physical
AI builds and too little late Tank Bash scaling. Recovery-face preferences and
Bash's level budget were adjusted; enemy floor budgets and camp prices stayed
unchanged. Future live-run feedback should guide further tuning, especially
support-heavy parties facing regenerating or shielding enemies.

### Validation for this revision

- The full `npm test` run exercised 367 checks: 366 passed; its sole failure was
  an old Jester test expecting the superseded ×2.5 critical face and rejecting
  the valid ×1.5 face. That expectation was corrected to the unchanged current
  class pool; all 12 tests in `punchline-update.test.cjs` then passed.
- All 18 current `identity-update.test.cjs` checks passed, including the added
  restart-during-burst cancellation and hostile Berserker wound/healing cases.
  Together with the full run and affected-file rerun, all 368 distinct current
  checks have passed. The feedback/art/layout group also passed all 30 checks.
- The complete UI review produced 176 captures without browser errors or
  external requests. The final `UI_REVIEW_SCOPE=identity npm run review:ui`
  produced eight more current captures, covering actual mark flights, caps,
  Steady, Fury gain/spending, equal-face editing and the guide at 320–1920 px.
- The guide's complete topic set passed its readability and bounds checks at
  1920×1080, 1280×800 and 390/320 px. Compact bullet spacing keeps text at least
  12 rendered pixels without changing navigation positions or adding scrolling.
- The standalone HTML/ZIP preserve every original drawing and embedded asset.
  A fresh Chromium session with external requests blocked opened the backup,
  decoded all five uploaded WAV samples and played the large slot-lock sample;
  embedded WAV bytes were compared directly with their source files.
