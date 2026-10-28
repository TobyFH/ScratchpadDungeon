# Readable powers and expedition difficulty

> Current follow-up: [Curve and recovery tuning](CURVE_TUNING.md) supersedes
> earlier numeric examples for enemies, recovery, traits, biomes and nests.

> **Current combat:** [Combat identity](COMBAT_IDENTITY.md) supersedes older
> weighting purchases, free/boosted Punchlines, Fury, stun and uncapped-block
> examples below. Use its shared sources and migration rules for new changes.

This is a numeric balance pass, not a new slot system or art pass. Match rules,
weighted faces, editable ranks, class seals, item interactions, enemy clocks,
statuses and player controls retain their established rules. No icon, texture,
font, portrait, sound or stylesheet was replaced.

## Shared numbers and ownership

`game/balance.js` owns ordinary mark powers, rank prices, hero base health,
class critical pools, Flurry's face distribution, the ten floor budgets, core
species profiles and encounter EXP. The existing builder embeds it in the
standalone HTML. Edit that source and run `npm run build:ui`; do not edit its
marked HTML region. Biome species still live in `game/biome-enemies.js`; signature
formulas live in `hero-builds.js`/`battle-tactics.js`; affinities and validated
transactions live in `reel-upgrades.js`. Camp lesson amounts/prices remain in the
camp catalogue. There is no external runtime data dependency.

| Mark | Rank I | II | III | IV |
| --- | ---: | ---: | ---: | ---: |
| Physical damage | 1 | 2 | 3 | 4 |
| Spell damage | 1 | 2 | 3 | 4 |
| Healing, HP | 2 | 4 | 6 | 8 |
| Team block | 2 | 4 | 6 | 8 |
| Stun / poison / stimulant / Trick power | 1 | 2 | 3 | 4 |
| Blood Price, HP paid | 2 | 4 | 6 | 8 |

These are **base values per landed mark**, before equipment, signatures, buffs,
lessons, rounding and criticals. They are shared across classes: the previous
hidden Rogue physical penalty and general healing multiplier are removed.
Tier III–IV and critical damage still affect all enemies. Blanks, the class seal
and its matching-pair wildcard rule are unchanged. Blood Price never kills its
caster or multiplies its HP cost.

Physical/spell names appear in the workshop, hover descriptions, combat
breakdowns, equipment descriptions and field guide. Icons remain exactly the
same. A hero can still act repeatedly. Defensive Mages start with Spell II so their first fights do not depend on a
rare Spell I match. A Tank or Mage can still be rebuilt for solo damage; a support party does not impose an artificial role restriction.

## Distinct build incentives

Every listed multiplier is an equally likely face of the existing critical
roller. Enemy and event rollers are separate from these pools.

| Class | Base HP | Critical pool | Practical build direction |
| --- | ---: | --- | --- |
| Tank | 50 | ×1.5, ×1.75, ×2, ×2.25 | Cheap shields feed Shield Bash; stun/control, or a slower durable physical build |
| Rogue | 26 | ×2, ×3, ×4, ×5 | Physical matching combos or poison pressure; expensive healing and little room for mistakes |
| Mage | 28 | ×1.75, ×2, ×2.5, ×3 | Solo spell combos, or healing/shield/poison Resonance supporting other attackers |
| Ranger | 30 | ×2, ×2.5, ×3, ×4 | Wait behind other actors, then Execute a wounded target; stun/support while charging |
| Berserker | 38 | ×1.75, ×2.5, ×3, ×4 | Physical damage plus Blood Price, balanced with healing and Fury lifesteal |
| Jester | 30 | ×1.5, ×2, ×3, ×4 | Trick and mixed support/damage for boosted Punchlines and Wildcard utility |

Unmodified rank-up prices are **3 / 6 / 10** points for ranks II / III / IV,
then multiplied by class affinity and rounded up. Tank shield affinity is 0.65,
physical 1.35; Rogue physical is 0.8, poison 0.85; Mage spell is 0.85. Existing
other affinities still apply. For example Tank rank II shield costs 2 points,
physical costs 5; Rogue physical costs 3. Inscribing blanks keeps its existing
base price of 3 with class affinity; a Defensive Tank inscribes block as its
primary mark. Refund receipts, paid weighting and permanent seal validation are
unchanged. Existing investments refund their actual paid amount under the usual
half-refund rule, not a fabricated new purchase price.

The workshop displays the class critical range and a concise build suggestion;
the Critical odds page still enumerates exact weighted type-and-tier matches.
Flurry rolls the same three additional attacks from the same weighted faces,
now using the shared linear attack tiers. Autoplay's Flurry estimate reads that
actual distribution rather than the former fixed damage estimate.

## Enemy curve

The ordinary reference is modified by species, elite, paired, mimic, stronghold
and challenge factors. Guardians have an independent health/damage budget.
Attack strength is a reference hit budget: damaging marks scale one combined
enemy hit by `min(1, .65 + totalAttackPower / 40)`, before buffs/criticals.
An empty/non-damaging roll still does no direct hit. This keeps ordinary enemy
hits more predictable while preserving their different wheels and statuses.

| Floor | Reference HP | Strength | Guardian HP | Guardian strength | Guardian strikes |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 13 | 3 | 28 | 4 | 1 |
| 2 | 17 | 4 | 36 | 5 | 1 |
| 3 | 22 | 5 | 47 | 6 | 1 |
| 4 | 28 | 6 | 60 | 7 | 1 |
| 5 | 35 | 7 | 76 | 8 | 1 |
| 6 | 43 | 8 | 94 | 9 | 2 |
| 7 | 52 | 9 | 116 | 10 | 2 |
| 8 | 63 | 10 | 140 | 11 | 2 |
| 9 | 75 | 11 | 168 | 12 | 2 |
| 10 | 88 | 12 | 205 | 14 | 3 |

Reference ordinary frequency is three player actions on floors 1–2, two after
that. Guardian frequency is two. Frenzied still attacks one action sooner;
species cadence now also distinguishes quick rats from slow slimes, bellkeepers
and page eaters. Pairs retain two independent clocks and one shared block pool.
Enemy critical faces are ×1.25 / ×1.25 / ×1.5 / ×1.5; their maximum spike is lower
than before. Promotion happens on floors 4 and 8; the final guardian still rolls
top-tier damage and three strikes. Species differ in endurance, damage, cadence,
face distributions and their existing passives. The Unwritten retains its
additional pressure and improved item rewards.

## Camp progression target

The tuning aims for an exceptionally difficult fresh expedition, a plausible
completion with a developed camp and a much more forgiving fully trained party.
There is no artificial first-run lock, damage rubber-banding or hidden modifier
based on how many runs the player has lost. Good luck, excellent builds and
careful play can still win without lessons.

| Lesson | Each active rank | At five ranks |
| --- | --- | --- |
| Stouter hearts | +25% starting base HP | +125% |
| Practised strikes | +30% physical/spell roll damage | +150% |
| Lessons remembered | +10% earned EXP | +50% |
| Coins for the road | +50 starting gold | +250 |
| Mending hands | +2 HP per positive healing effect | +10 HP |
| Shields by the fire | +2 opening team block | +10 |
| A welcome at the fire | +10% companion likelihood, multiplicative | +50% |
| An eye for silver | +3% chest/spoil gold | +15% |

Prices, IDs, ownership, banking transactions and selected-rank controls are
unchanged. Lessons still use the highest selected rank, not a sum of all ranks.
No save wipe or schema bump is necessary. Existing edited faces, paid weights,
points, equipment, wounds and banked gold survive. Existing maximum HP and an
already-created enemy are preserved on load; new heroes/encounters use the new
budgets. Selected rule IDs remain snapshotted for an expedition; updated numeric
lesson formulas take effect where that existing snapshot references a lesson.
For a clean comparison of the new curve, begin a new expedition.

Autoplay build scores use the smaller power scale and active lesson bonuses.
Poison, stun and buffs have diminishing value rather than crowding out every
attack; solo damage floors remain. After several support-only rolls, Autofight
chooses actual offensive potential rather than sorting attackers by their
healing-heavy total score again. These are AI preferences, never restrictions on
manual builds or changes to reel outcomes.

## Verification and repeatable tuning

- `npm test`: browser/data regressions, including linear tier powers, every class
  critical pool, floor monotonicity, final multi-strikes, prices, shared marks,
  lesson separation and the support-loop escape.
- `npm run review:ui`: text/layout review at desktop, 1280×800 and compact sizes.
- `npm run audit:balance`: seeded browser combat gauntlets using the real
  `spin`, weighted draws, status rules, enemy clocks, paid AI edits and actor
  policy. `BALANCE_RUNS` sets seeds per camp configuration; default 12.
  `BALANCE_REPORT` selects the JSON report path.

The audit removes animation waits, confirmations, travel and loot; supplies,
equipment, artefacts, shop healing, exploration points and rare personal saves
are absent. Recruits arrive on floors 3 and 5, one well is used per floor and
four encounters are fought per floor (three ordinary, then the guardian).
These controlled results measure a progression differential, **not human win
rates** or the real distribution of exploration, companions and loot. Follow up
with human playtesting, particularly highly concentrated weak-mark combos,
armoured targets, party recovery and the late Frenzied guardians. Do not claim
that a particular percentage of players will win from this harness alone.

### Recorded audit sample

The checked-in [72-case report](BALANCE_AUDIT.json) records 24 seeded expeditions
per configuration, split evenly between Tank, Rogue and Mage starts. The middle
configuration activates ranks 2 and 3 alternately across the eight families: 20
of 40 lesson ranks, rather than half of the gold cost. Class invitations are
not part of this numeric comparison.

| Active lessons | Completed gauntlets | Mean floor reached | No-progress stops |
| --- | ---: | ---: | ---: |
| None | 1 / 24 | 6.29 | 1 |
| Half of available ranks | 6 / 24 | 9.00 | 1 |
| All ranks | 14 / 24 | 9.63 | 2 |

These small samples show the intended progression advantage. Fully trained
parties still have losses in this deliberately supply-free scenario; all three
starting classes have completions when trained. Actual campaigns add equipment,
artefacts, shops, supplies and earned traits, but also vary in available
companions, exploration and hazards. Human playtesting is still needed to
establish how often real fresh and fully developed camps win. A no-progress
stop counts as a failure, not a victory; a player could respec or use supplies
when the same situation occurs in the live game.
