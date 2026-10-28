# Encounter pace, recovery and exploration tuning

This supersedes earlier numeric examples about biome frequency, recruitment,
nests, temperament, traits, stimulant limits and Mage recovery. It leaves raw
rank powers, three-of-a-kind matching, critical pools, paid editing/refunds,
class locks, corpse art, audio and camp ownership intact. Rebuild embedded
sources with `npm run build:ui`; the distributable remains one offline HTML.

## World distribution and companionship

`availableBiomes` / `chooseFloorBiome` in `game/biomes.js` are the authority.
Ordinary generation always starts with **Caverns on floor 1**. Floors 2–4 draw
uniformly from all eight non-lava biomes, including Caverns. Floors 5–10 draw
uniformly from all nine. The explicit force argument is for fixtures and does
not bypass normal eligibility in play. Equal selection odds do not guarantee
one of each theme in any particular run. Existing floors keep their theme.

`RECRUITMENT_TUNING` / `recruitChance` in `game/hero-builds.js` give a floor-one
base chance of 55% solo, 43% with two living heroes, and 30% with a full party.
Each deeper floor adds 2.5 percentage points; missed floors add 7 points solo or
5 otherwise. Caps are 96% / 88% / 65%. Camp recruitment modifiers still apply.

A saved `earlyRecruitOffered` receipt records a real wanderer meeting on either
of the first two floors, including a declined invitation or a Companion's Horn.
If none was met on floor one, floor two always contains a recruit tile. This is
an encounter opportunity, not a forced join or automatic fourth member. The
generator reserves this meeting before optional discoveries can exhaust a tiny
floor's free cells. A
covered, ignored wanderer on floor one does not remove the guarantee. The load
repair adds a missing floor-two recruit deterministically to an eligible floor
cell without changing walls, bridges, stairs or other discoveries. New runs
reset the receipt. The starting selection uses the chosen temperament; found companions still
draw temperament independently at random.

Shops rise from 40% to **46%** per floor; Markets rises from 66% to **70%**.
Optional walled strongholds now attempt placement on **18%** of floors, up from
3.5%; unsafe or occupied sites still skip placement. Their chance is centralized
in `WORLD_BALANCE.strongholdChance`, with the existing encounter/reward rules.
Returned companions now have **12%** chance per eligible ordinary encounter
(up from 6.5% in the initial curve pass).
Their existing later-floor, graveyard and one-return-per-person restrictions
remain; nothing resurrects the original companion.

## Exclusive nest finds

`nestContents` is one saved per-cell value: `gold` or `egg`, equally likely.
Generation sets it; an older nest sets it once on first interaction. Declining,
revisiting, inspecting or reloading does not reroll its contents.

- An empty nest offers a **gold-only reel roll**, with normal gold criticals.
- A full nest offers one egg, restoring 65% of one hero's maximum HP.
- Either actual claim has exactly **50%** chance to summon the elite broodmother.
- Leaving has no mother check. Rejecting the egg at a full bag leaves it active
  in the nest and cannot summon the mother. Claiming, swapping into a pocket or
  immediately using the egg counts as taking it.

`processPendingItems` marks the actual drop with `claimed`; nest decisions use
that receipt rather than guessing from bag size (which misses immediate use).
Autoplay chooses whichever exclusive reward exists, and retains ordinary bag
handling. No item, personal-point or artefact faces are in the nest coin roll.

## Stronger early pressure, shorter tough fights

`FLOOR_BALANCE` and `ENCOUNTER_TUNING` in `game/balance.js` remain shared by real
encounters, summons and previews. Reference damage and guardian strength gain
one on floors 1–7. `enemyHitPressure` then adds 8–12% before the existing rounded
combined-hit calculation; floors 8–10 have no extra pressure multiplier. Empty
rolls remain empty. Enemy criticals retain their bounded ×1.25–×1.5 pool.

| Floor | Ordinary strength | Guardian HP | Guardian strength | Guardian strikes |
| --- | ---: | ---: | ---: | ---: |
| 1 | 4 | 24 | 5 | 1 |
| 2 | 5 | 31 | 6 | 1 |
| 3 | 6 | 40 | 7 | 1 |
| 4 | 7 | 51 | 8 | 1 |
| 5 | 8 | 65 | 9 | 1 |
| 6 | 9 | 80 | 10 | 2 |
| 7 | 10 | 99 | 11 | 2 |
| 8 | 10 | 119 | 11 | 2 |
| 9 | 11 | 143 | 12 | 2 |
| 10 | 12 | 174 | 14 | 3 |

Guardians lose roughly 15% of their former HP. Elite HP factor is 1.18 instead
of 1.25; stronghold factor is 1.25 instead of 1.4. Species endurance above 1.1
keeps 70% of its excess, trimming bulky opponents while retaining their identity.
Frail species keep their original HP factor.

Boss reel palettes keep at most one face of each defensive kind; repeated
healing, block or stun faces become appropriate attack marks. Boss stun caps at
rank I, other utility marks (including heal/block) at II. Attacks still promote normally, including rank IV and
three strikes for the final guardian. Boss/stronghold healing rolls use 35% of
raw healing instead of 50%. Second Wind restores 18% guardian / 20% stronghold /
25% ordinary maximum HP, still once below 30%. Armoured guardians/strongholds
resist one per hit even late, allowing modest ordinary attacks to make progress.
Other late armoured creatures keep two resistance. Shared block caps and all
stun/Steady protections remain intact. These changes shift danger toward attacks
and give mixed parties more opportunities to end a fight without endless healing
or repeated stun chains.

Existing ongoing encounters keep their stored HP and reels; new encounters use
these budgets. No run, unlock or paid-edit save is wiped.

## Mage recovery, stimulant and personality

`SUPPORT_SCALING` in `hero-builds.js` gives Mage healing **5% per level after
four**, capped at **40%** (level 12). Rank powers remain 2/4/6/8; the class bonus
is added and rounded once before ordinary criticals. Healing Resonance offers
`3 + ceil(level × .6)` base HP to each living ally; it still clears allied stuns.
Self-heal marks can now select healing Resonance, but their own healing stays
strictly on the caster. Normal ally-heal marks still heal only the selected ally.
At level ten, an unmodified 24-HP Mage roll becomes 31 HP, versus 28 previously.

Stimulant still lasts at most three own actions. Every **two** doses beyond full
duration add one potency, capped at **8**. Damage is `1 + floor(potency / 2)`;
resistance remains `1 + floor(potency / 5)`, giving +5 damage / +2 resistance at
full potency. Shared helpers drive real damage and tooltip values. Normalization
converts saved overflow once, retaining partial progress; it is idempotent.

Temperament adds flat bonuses only when the relevant effect is already positive:

- **Aggressive:** +1 physical, spell and poison power.
- **Defensive:** +1 self/ally/team healing, shared block and stun power.

Bonuses apply before criticals, like earned traits. They do not change a face's
base rank, probability, price or saved type. Actual rolls and AI estimates call
the same `temperamentEffects` helper. Found temperaments are still random.
Autoplay preserves its repaired Jester Trick share during later paid upgrades,
so the new offensive bonus cannot crowd those class marks back off the wheel.

Heroic damage, Merciful healing, Cowardly block, Stoic/Wary opening block,
Invigorated received healing and Focused stun gain one point. Reckless damage
rises from +2 to +3; Venomous supplies two extra poison doses. Hardy/Stubborn keep
one resistance and also gain +1 block on shield rolls, avoiding early immunity
from doubling flat resistance. Bookish rises from 5% to 8% EXP with its existing
fractional receipt. Existing penalties remain unchanged. All hover descriptions
state the actual values; earned reasons, replacement rules and event odds stay.

## Workshop presentation

The default icon workshop has only Edit and Critical odds pages. Its separate
class-price page is removed: each live choice already shows its exact cost.
Replacement glyphs are smaller while names/prices stay legible. The current
face preview is larger (64px desktop / 48px compact), with consistent reserved
geometry for permanent faces. The prior editor remains behind the same
`reelWorkshopLayout = "legacy"` fallback; its independent cost table is retained.
See [the workshop contract](ICON_REEL_WORKSHOP.md).

## Validation and limits

Run the new `tests/curve-tuning.test.cjs`, existing workshop/ice/recovery tests,
then the full suite and `npm run review:ui`. The new tests cover uniform picker
odds, real guaranteed generation, saved meeting receipts, shorter boss budgets,
actual recovery/temperament effects, exclusive nests, the claim receipt, full-bag
rejection and the mother boundary at .5. Generated layouts must still preserve
every approach to distant stairs, including ice, tunnels and fragile terrain.

`tools/balance-audit.cjs` now accepts `BALANCE_HTML=/path/to/index.html` for a
before/after comparison with the same harness. It skips cosmetic class sketches
as well as other animation waits, retaining real combat calculations and AI.
The audit recruits at floors 3 and 5 and omits shops, supplies and travel; it does
not simulate the new early-companion guarantee or predict human win rates.
Small seeded samples are a diagnostic, not proof of campaign difficulty.
