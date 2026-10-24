# Camp, banking and expedition rules

Banking is offered on guardians' floor-clear sheets for floors 1–9. Choose 25%, 50%, 75%
or 100% of **currently carried gold**, rounded down. Continue without banking
if you prefer to keep it for shops. Each ordinary floor permits one deposit. The final
victory automatically banks **all carried gold plus the final reward**. There
are no percentage choices on that sheet; the adventurer records remain open.
Gold left with a defeated party is lost on a new run;
gold already at camp remains.

Open **New run → Upgrades** (or the Upgrades tab in the first adventurer chooser).
Purchases are permanent. The Ranger invitation unlocks Ranger starts and wandering
companions for subsequent expeditions. Other purchases are initially disabled: enable or
disable them to build your next expedition's rules. Changes do not rewrite a
current run. Owned unlocks can be freely toggled between runs; purchases cannot
be refunded. Nothing requires an account or network connection.

## Unlock catalogue

| Page        | Unlock                  | Cost | Enabled effect                                              |
| ----------- | ----------------------- | ---: | ----------------------------------------------------------- |
| Adventurers | A ranger's invitation   |   80 | Unlock starting and wandering Rangers; permanent            |
| Provisions  | A little spending money |   60 | Start with 20 gold                                          |
| Provisions  | A hearty breakfast      |  100 | New adventurers gain 4 maximum HP                           |
| Provisions  | Spread the word         |   95 | Recruit spawn probability ×1.25, capped at 95%              |
| Provisions  | Follow the water        |   85 | One extra well per floor                                    |
| Challenges  | Iron margins            |   65 | Enemy HP ×1.2 and base damage ×1.1, rounded up              |
| Challenges  | Never alone             |   70 | Double-encounter chance +8 percentage points, capped at 33% |
| Challenges  | Dry ink                 |   55 | One fewer well per floor                                    |
| Challenges  | Restless pages          |   60 | Pursuer awakens at 12 revealed tiles, from floor 3          |
| Oddities    | Heavy pockets           |   90 | One extra treasure chest per floor                          |
| Oddities    | Leave a light on        |   75 | One extra beacon per floor                                  |
| Oddities    | Travelling market       |  100 | Shop spawn probability 66% per floor                        |
| Oddities    | Both ends sharpened     |   80 | Hero damaging rolls +1 damage; enemy base damage +1         |

There are 13 unlocks; the Ranger invitation is the only class-specific purchase.
Provisions and challenges can coexist: for example, an extra well and Dry ink cancel one another. All
options have actual gameplay hooks, not preview-only controls.

## Ranger

Rangers start at 30 HP, with blade attacks, some poison, stun and block, plus
ordinary upgradable EMPTY faces. Its middle **Execute** seal strengthens a
patient finishing shot. Each party action without the Ranger attacking builds
patience up to six; a nondamaging seal roll adds two. Its next damaging roll
consumes that charge for a bonus based on the selected enemy's missing health.
The meter and bow tooltip show charge and the current bonus. See
[Combat builds](COMBAT_BUILDS.md) for the formula and migration.

Notched Longbow (+2 damage) and Scout Cloak (1 resistance, 2 opening team block)
are matching Ranger equipment. They only enter loot pools in Ranger-unlocked
expeditions. Starting as a Ranger requires only the invitation.

## Save design and recovery

- `game/progression.js` owns the stable unlock IDs, catalogue, validation,
  transactions and camp UI. `tools/build-ui.cjs` embeds it into the standalone
  HTML; never edit its generated HTML region directly.
- `scratchpad-dungeon-camp-v1` stores profile version 1, bank balance, purchased
  IDs, enabled IDs and the deposit ledger. It is independent of the expedition
  and preference keys. New run never deletes it.
- Expedition save version 17 retains the version-13 `runId`, `bankedFloors` and
  snapshot of enabled `runRules`. Versions 1–14 still migrate; old expeditions start
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
browser's Application/Storage → Local Storage panel, retaining the key names.
Restore them to the same origin before reloading. Do not alter the deposit ledger
or reuse old expedition snapshots without their matching camp profile. There is
no gameplay-facing import UI in this change.

## Validation

`npm test` exercises percentage rounding, duplicate deposits, reload/new-run
persistence, interrupted-write recovery, unavailable storage, invalid fractions,
unearned transfers, prerequisites, purchase costs, rule snapshots, Ranger charge,
real map/stat modifier hooks and the final victory banking buttons. Camp and
bank sheets are measured at 1920, 1280, 390 and 320 pixel widths. Visual review
adds camp categories, a five-class chooser, Ranger combat and a real status
hover. See the main README for browser installation and review commands.
