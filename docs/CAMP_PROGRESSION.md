# Camp, banking and expedition rules

Banking is offered on guardians' floor-clear sheets for floors 1–9. Choose 25%, 50%, 75%
or 100% of **currently carried gold**, rounded down. Continue without banking
if you prefer to keep it for shops. Each ordinary floor permits one deposit. The final
victory automatically banks **all carried gold plus the final reward**. There
are no percentage choices on that sheet; the adventurer records remain open.
Gold left with a defeated party is lost on a new run;
gold already at camp remains.

Open **New run → Upgrades** (or the Upgrades tab in the first adventurer chooser).
Purchases are permanent. Ranger and Berserker invitations unlock starts and wandering
companions for subsequent expeditions. Their locked starter cards remain visible;
click one to open its camp purchase. Tank, Rogue and Mage are available initially.
Existing heroes are retained when migrating a run.

Permanent training applies automatically to future expeditions. Other modifiers
start disabled and can be freely toggled for the next run. Purchases do not
rewrite a current expedition's snapshotted rules and cannot be refunded. Nothing
requires an account or network connection.

## Unlock catalogue

The catalogue in `game/progression.js` is authoritative; stable IDs survive price
changes. Gold income is unchanged. Existing owned purchases remain owned without
an additional charge.

| Page        | Stable ID    | Unlock                  |  Cost | Effect when enabled                               |
| ----------- | ------------ | ----------------------- | ----: | ------------------------------------------------- |
| Adventurers | `ranger`     | A ranger's invitation   |   900 | Permanent Ranger starts/recruits                  |
| Adventurers | `berserker`  | A berserker's oath      |   750 | Permanent Berserker starts/recruits               |
| Provisions  | `provisions` | A little spending money |   900 | Start with 150 gold                               |
| Provisions  | `hearty`     | A hearty breakfast      | 1,100 | +4 base maximum HP before training                |
| Provisions  | `company`    | Spread the word         | 1,500 | Recruit probability ×1.25, capped at 95%          |
| Provisions  | `springs`    | Follow the water        | 1,800 | One extra well per floor                          |
| Challenges  | `iron`       | Iron margins            |   600 | Enemy HP ×1.2, damage ×1.1, rounded up            |
| Challenges  | `crowded`    | Never alone             |   700 | Double chance +8 percentage points, cap 33%       |
| Challenges  | `drought`    | Dry ink                 |   500 | One fewer well per floor                          |
| Challenges  | `hunted`     | Restless pages          |   650 | Pursuer threshold 12 revealed tiles, from floor 3 |
| Oddities    | `golden`     | Heavy pockets           | 1,900 | One extra chest per floor                         |
| Oddities    | `lanterns`   | Leave a light on        | 1,200 | One extra beacon per floor                        |
| Oddities    | `markets`    | Travelling market       | 2,200 | Shop chance rises from 36% to 66%                 |
| Oddities    | `sharp`      | Both ends sharpened     |   800 | Damaging hero rolls +1; enemy base damage +1      |

The fifth page, **Training**, shows each family's next tier. Higher tiers require
the preceding tier. Bonuses are the highest owned rank, **not the sum of ranks**.
These purchases are permanent, automatically enabled, and snapshotted next run.

| Stable IDs                    | Tiers | Cost of each successive tier        | Total bonus at each tier              |
| ----------------------------- | ----: | ----------------------------------- | ------------------------------------- |
| `vitality1` … `vitality5`     |     5 | 750 / 1,500 / 3,000 / 5,500 / 9,000 | +10 / 20 / 30 / 40 / 50% base HP      |
| `power1` … `power3`           |     3 | 900 / 2,000 / 4,500                 | +5 / 10 / 15% blade/magic roll damage |
| `experience1` … `experience3` |     3 | 800 / 1,800 / 4,000                 | +5 / 10 / 15% battle EXP              |

New hero HP is `round((classBaseHP + heartyBonus) * (1 + .1*vitalityRank))`.
Level-up gains remain +6 HP. Strike training rounds the multiplied damaging roll;
EXP training carries fractional bonus EXP forward per hero to avoid losing small
awards to rounding. There are 25 stable purchase IDs across the five pages.
Provisions and challenges can coexist; an extra well and Dry ink cancel out.

## Shop spending

`game/economy.js` owns supply, equipment, healing and map spending curves. All
manual and automated purchases use `shopPrices()`. At floor one a base tonic
costs **92**, equipment **188**, a solo full heal **150**, and stairs information
**106**. Full heals cost more for larger living parties. Better supply variants
cost more. The rare travelling cartographer charges 80% of that floor's basic
tonic price, rounded to the nearest gold. See [Expedition update](EXPEDITION_UPDATE.md) for exact
curves and the gold-income audit.

## Ranger and Berserker

Ranger starts at 30 HP. Execute builds two patience per party action without
attacking, or three on its own nondamaging seal. Charge caps at six; the
next damaging roll consumes it for a stronger finishing shot. The meter and bow
tooltip show its current target's bonus. Notched Longbow and Scout Cloak enter
loot pools only in Ranger-unlocked expeditions. There are no Ranger-specific
camp stat upgrades.

Berserker starts at 38 HP with blade, healing, Blood Price and empty faces.
Wounds and Blood Price fill Fury for additional blade damage; Bloodrush is its
permanent middle seal. See [Combat builds](COMBAT_BUILDS.md) and
[Battle tactics](BATTLE_TACTICS.md) for the exact rules.

## Save design and recovery

- `game/progression.js` owns the stable unlock IDs, catalogue, validation,
  transactions and camp UI. `tools/build-ui.cjs` embeds it into the standalone
  HTML; never edit its generated HTML region directly.
- `scratchpad-dungeon-camp-v1` stores profile version 1, bank balance, purchased
  IDs, enabled IDs and the deposit ledger. It is independent of the expedition
  and preference keys. New run never deletes it.
- Expedition save version 18 retains the version-13 `runId`, `bankedFloors` and
  snapshot of enabled `runRules`. Versions 1–17 still migrate; old expeditions start
  without new modifiers and retain their wounds, equipment and edited reels.
- A deposit is keyed by `runId:floor`. The profile write commits the transaction
  before the expedition is updated. If the expedition write is interrupted,
  loading subtracts the difference between each committed deposit and its
  acknowledged amount, then updates the acknowledgement. Ordinary floors still
  reject repeat deposits. `commitCampDeposit()` owns the shared write order.
- `bankVictoryGold()` transfers the entire carried balance on victory and on
  loading a completed tenth floor. It can extend a legacy partially banked
  tenth-floor deposit; difference-based reconciliation prevents double charging
  if that extension's run write is interrupted. The victory reward is saved
  before transferring, and `finishVictory()` refuses a second reward.
  If the camp write fails, gold stays with the party; the actual failure exposes
  a retry control instead of percentage choices. Coin effects use the amount
  successfully transferred, not a fixed celebration value.
- Purchases re-read and validate the latest profile, prerequisite and balance
  before writing. Costs, deposits and balances must be safe nonnegative integers.
  Failed profile writes leave carried gold and purchases unchanged. Corrupt
  profile records are reported and not silently overwritten by a transaction.
- Retired `rangerFocus`, `rangerHeart` and `rangerStart` purchases refund their
  original 110/90/140 gold costs once, using unique purchased IDs. Removed IDs
  leave both owned/enabled lists; the refund and `rangerRefunded` marker commit
  in the same profile write. An interrupted/failed write leaves the old profile
  available for retry, not a partial refund. These exceptional retirement refunds
  do not make ordinary purchases refundable. Existing hero HP is retained;
  removed bonuses no longer affect new heroes, Execute gain or saved expedition rules.
- This is browser-local persistence, not a server economy or cross-device sync.
  Use one active game tab when banking or purchasing. Clearing site data removes
  the camp as well as the run. Different sites/browser profiles have different
  camps. **Save HTML saves the game, not local-storage progress.**

To back up progress manually, copy both the expedition and camp values from the
browser's Application/Storage → Local Storage panel, retaining the key names. The separate `scratchpad-dungeon-bestiary-v1` key stores
discoveries and may also be backed up.
Restore them to the same origin before reloading. Do not alter the deposit ledger
or reuse old expedition snapshots without their matching camp profile. There is
no gameplay-facing import UI in this change.

## Validation

`npm test` exercises percentage rounding, duplicate deposits, reload/new-run
persistence, interrupted-write recovery, unavailable storage, invalid fractions,
unearned transfers, prerequisites, escalating training tiers, purchase costs, class locks, rule snapshots, Ranger charge,
real map/stat modifier hooks and the final victory banking buttons. Camp and
bank sheets are measured at 1920, 1280, 390 and 320 pixel widths. Visual review
adds camp categories, a five-class chooser, Ranger combat and a real status
hover. See the main README for browser installation and review commands.
