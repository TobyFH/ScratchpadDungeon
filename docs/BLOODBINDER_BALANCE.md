# Bloodbinder: establish a wound, then sustain the party

> Historical measurements for the retired Bleeding/Clotted/Exchange design.
> They do not describe the current class. See [SOUL_CLASSES.md](SOUL_CLASSES.md)
> for save-24 reservoirs, Blood Bloom, costs and current verification.

This pass follows the player's chosen identity: **win long fights through
sustained healing and anti-healing**. Mage remains the stronger dedicated raw
healer; Rogue and Ranger remain stronger dedicated direct attackers. Bloodbinder
can specialise in draining, direct healing, damage or a mixture, but buying an
entire reel of Seeds should have diminishing returns rather than unlimited
stacking. The player approved increasing **caster HP costs** as active Bleeding
gets stronger. This is not an increased point price for purchasing Seed faces.

This document supersedes the original numeric examples in
[BLOODBINDER_UPDATE.md](BLOODBINDER_UPDATE.md). Artwork, other classes, enemies,
floor budgets, item prices, permanent unlocks and purchased face receipts are
unchanged. The downloadable game remains one offline HTML file.

## Shared tuning

`game/bloodbinder.js` owns `BLOOD_BINDING`, `bloodProfile()`, the pure
`bloodSeedPlan()`, actual applications, ticking and anti-healing. All descriptions
and AI forecasts use these helpers. Scaling uses **hero level**, not floor depth:
a high-level companion retains their strength, and visiting a deeper floor does
not give a level-one hero a free boost.

| Hero level | Drain damage cap | Shared healing per actual damage | Clotted reduction | Exchange share of HP gap |
| --- | ---: | ---: | ---: | ---: |
| 1 | 3 | 75% | 35% | 18% |
| 4 | 5 | 75% | 38% | 19% |
| 7 | 7 | 97.5% | 47% | 22% |
| 10 | 9 | 120% | 56% | 25% |
| 13 | 12 | 142.5% | 65% | 28% |
| 14+ | 12 | 150% | 65% | 28% |

Healing rounds down once per enemy turn, with a minimum of one for a positive
drain. It is **one pool for the whole party**, allocated to the most injured
health ratios; it is never multiplied by the number of allies. At level 14 a
12-damage tick can share 18 HP total, not 18 per ally. Killing a foe with only
2 HP left shares at most 3 HP. Camp recovery, gear and critical multipliers do
not multiply this fixed pool. Direct ordinary healing still follows the usual
healing rules.

Base HP remains 32, plus the existing six HP per level. The class critical pool
stays ×1.5/2/2.5/3. Legal ordinary marks remain Physical, Spell, Heal, Blood Seed
and Empty; the permanent middle mark is Blood Exchange.

## Seed power and the blood offering

Each unit of rolled Seed power first creates or extends Bleeding to three enemy
turns. Remaining power increases damage up to that hero's level-dependent cap.
Buying that extra strength spends HP based on **current** wound strength:

| Current damage per tick | HP for the next +1 damage |
| --- | ---: |
| 1–4 | 1 |
| 5–8 | 3 |
| 9–12 | 6 |

A fresh wound and duration refreshes are free. A level-one three-turn wound at
strength three takes two HP to establish. A level-13 strength-12 wound costs
34 HP from scratch. That upfront risk takes time to repay; healing or attacking
while it ticks is more useful than continuing to roll already-capped Seeds.
An example fully established late drain returns 51 HP over three own enemy
turns at level 13, before subtracting its 34-HP setup cost and any enemy attacks.

Offerings bypass team block, resistances and Vulnerable. They use the shared
self-inflicted damage path and cannot take the caster below one HP. If the next
strength increase is unaffordable, it does not happen; there is no free strength
at one HP. Duration already extended remains valid. Extra power at the damage
cap is wasted **without another HP charge**. Criticals increase rolled power,
never multiply the established tick or an offering again.

Bleeding belongs to the enemy, so multiple Bloodbinders share one wound and
one cap. Refreshing with a weaker caster preserves the stronger existing
profile. The latest contributor receives subsequent drain credit as before.

## Reliable anti-healing during long fights

Originally, repeatedly extending Bleeding could prevent Clotted ever appearing.
Now Clotted applies when Bleeding ends **or after every three actual ticks**,
even while the duration keeps being refreshed. Refreshing Seeds never resets
this tick counter. Its duration is the longest Bleeding duration reached, up to
three own enemy turns. Reapplying preserves the stronger reduction and remaining
duration. A newly applied Clotted does not immediately lose a turn.

All enemy recovery continues through `enemyRecovery()`: ordinary rolled healing,
Second Wind and Jester mercy are reduced consistently. Bleeding ticks once per
whole enemy turn, including a stunned turn; multi-strikes do not duplicate it.
Death and battle cleanup still stop all subsequent ticks and clear both states.

Exchange grows from 18% to 28% of the HP-fraction gap. Both branches retain the
**10% maximum-boss-HP cap**, actual-percentage healing, a selected target and no
critical/cleave/gear/camp/Vulnerable multiplier. This makes later support stronger
without an unbounded percentage attack against the final guardian.

## Builds, AI and migration

- **Drain:** establish a strong wound against healthy, shielded or regenerating
  opponents. Higher Seed ranks establish it sooner, but risk more HP upfront.
- **Hybrid:** keep enough Seeds to sustain the wound, then heal the party or
  contribute direct damage. Retain attacks to finish foes after the wound ends.
- **Mender:** more immediate selected-ally healing and Exchange; less damage and
  anti-healing than a drain hybrid. Mage's late raw recovery remains stronger.
- **Striker:** direct Physical/Spell is viable, with utility from occasional
  Seeds and Exchange; it does not inherit a Rogue/Ranger critical damage pool.

`bloodSeedForecast()` estimates marginal remaining drain/healing, the offering,
the current cap and relevant enemy recovery. Fixed pools are added **after**
ordinary crit/gear/camp math. Autoplay sees a capped three-turn wound as having
no additional damage or healing value, accounts for the caster HP cost and
favours some direct healing/attacks rather than filling every face with Seeds.
Forecasts interpolate fractional mean Seed power; they are an AI estimate, not
an exact promise of the next roll.

The workshop shows the current damage cap and HP risk; the full tooltip explains
cost bands and healing. Enemy status tooltips show actual damage, shared healing,
Clotted strength and remaining ticks. The guide and Event log use the same rules.

Ongoing wounds save level, tick progress, duration, source and potency. Legacy
wounds acquire their owner's level and clamp to its cap without retroactive HP
costs. Legacy Clotted retains its original 50% reduction until it expires. No
gold, points, equipment, ownership, settings or face purchases are reset.

## Reproduce and verify

```
npm run build:ui
node --test tests/bloodbinder-balance.test.cjs tests/bloodbinder-update.test.cjs
BALANCE_RUNS=24 npm run audit:bloodbinder
npm test
npm run review:ui
```

`tools/bloodbinder-balance-audit.cjs` uses real Chromium combat with presentation
waits suppressed by its test-only fixture. Paid edits obey live validators. It
compares equal point allowances at levels 2/7/13 and floors 2/5/10, four
Bloodbinder builds, healing Mage and damage Rogue/Ranger. It measures injured-team
throughput, HP spent, net healing and fresh actual staircase encounters with
either a fixed supporting party or one solo hero. No camp lessons, gear, items
or rare personal saves carry the comparison. Reports identify unspent points.

The throughput probe deliberately supplies wounds before each of 18 rolls and
uses a harmless three-roll-frequency boss dummy; it measures available recovery,
not ordinary fight duration or player campaign win rates. Percentage Exchange
damage against that high-HP dummy is excluded from its direct-damage statistic.
Fresh guardian trials use actual generated enemies and the shipped actor policy.
These limited probes diagnose relative strengths; live play remains necessary.

### Recorded before/after comparison

[BLOODBINDER_BALANCE_AUDIT.json](BLOODBINDER_BALANCE_AUDIT.json) records 24 seeds
per build and stage against the preceding `b6c6f49` release. The builder includes
every ordinary face, preserves affordable matching-column upgrades and keeps
the best forecast along that path; it does not force spending points when that
would reduce combo odds. This is a bounded build search, not perfect play.

| Probe | Before | After |
| --- | ---: | ---: |
| Level 2 drain, net recovery per roll | 4.25 | 2.03 |
| Level 7 drain, net recovery per roll | 5.13 | 2.56 |
| Level 13 drain, gross recovery per roll | 5.86 | 7.55 |
| Level 13 drain, net recovery including setup cost | 5.86 | 5.66 |
| Level 13 hybrid, gross recovery per roll | 11.66 | 13.03 |
| Level 13 direct healer, gross recovery per roll | 29.57 | 29.58 |
| Level 13 healing Mage, gross recovery per roll | 58.57 | 58.57 |
| Maintained high-level Bleeding: Clotted coverage in probe | 0% | 56% |
| Late drain party defeats fresh guardian | 15/24 | 21/24 |
| Late hybrid party defeats fresh guardian | 17/24 | 18/24 |

The 18-roll probe charges the entire setup offering: gross healing improves at
late levels, but net healing initially pays for that investment. The reliable
Clotted payoff helps in regenerating fights without restoring a free drain.
Late direct-hit probes give 14.96 HP/roll for the offensive Bloodbinder, 25.52
for Rogue and 22.50 for Ranger, excluding Blood Exchange and Bleeding. At the
small initial eight-point allowance, a defensive Bloodbinder's extra starting
heal faces can still beat a partly converted healing Mage; Mage overtakes it
with investment. This exception and unspent points are included in the report.

No unassisted solo build cleared the final guardian in this sparse sample.
That is consistent with needing a developed party/progression, but does not
measure a whole run with loot, fountains, camp lessons and player decisions.

### Validation

- Full regression run: **576 passed, zero failed**. Two later-added Bloodbinder
  checks are included in the final focused run below, rather than that earlier
  full-suite snapshot.
- Final focused Bloodbinder run: **11 passed**, covering costs/caps, free
  duration refresh, ongoing Clotted, overkill-limited shared recovery, critical
  application, forecasts, mixed paid AI builds, save bounds and boss transfers.
  The combined Bloodbinder feature/balance group also passed **29 checks**.
- Notebook review: **184 captures, zero browser errors or external requests**.
  Inspected the workshop at 1920 and 320px, status feedback and the current
  illustrated class guide at 390px. Existing layout/assets remain unchanged.
- Network-disabled Chromium loaded the self-contained HTML through a locally
  fulfilled entry request, purchased the class and resolved a real Seed critical
  with the expected cap/HP cost and no external requests. The ZIP's HTML was
  compared byte for byte with the generated distribution. This verifies embedded
  content without depending on this environment's blocked `file://` navigation.
