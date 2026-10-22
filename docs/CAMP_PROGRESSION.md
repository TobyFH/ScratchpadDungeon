# Camp, banking and expedition rules

Banking is offered on every guardian's floor-clear sheet. Choose 25%, 50%, 75%
or 100% of **currently carried gold**, rounded down. Continue without banking
if you prefer to keep it for shops. Each floor permits one deposit. The final
victory sheet also offers banking, including the victory gold, without closing
the adventurer records. Gold left with a defeated party is lost on a new run;
gold already at camp remains.

Open **New run → Upgrades** (or the Upgrades tab in the first adventurer chooser).
Purchases are permanent. An invitation unlocks Ranger encounters immediately
for subsequent expeditions. Other purchases are initially disabled: enable or
disable them to build your next expedition's rules. Changes do not rewrite a
current run. Owned unlocks can be freely toggled between runs; purchases cannot
be refunded. Nothing requires an account or network connection.

## Unlock catalogue

| Page       | Unlock                  | Cost | Enabled effect                                              |
| ---------- | ----------------------- | ---: | ----------------------------------------------------------- |
| Ranger     | A ranger's invitation   |   80 | Rangers join the wandering-companion pool; permanent        |
| Ranger     | Patient aim             |  110 | Aim stores 2 more damage                                    |
| Ranger     | Trail endurance         |   90 | New Rangers gain 6 maximum HP                               |
| Ranger     | A place at the campfire |  140 | Ranger becomes a starting-class choice                      |
| Provisions | A little spending money |   60 | Start with 20 gold                                          |
| Provisions | A hearty breakfast      |  100 | New adventurers gain 4 maximum HP                           |
| Provisions | Spread the word         |   95 | Recruit spawn probability ×1.25, capped at 95%              |
| Provisions | Follow the water        |   85 | One extra well per floor                                    |
| Challenges | Iron margins            |   65 | Enemy HP ×1.2 and base damage ×1.1, rounded up              |
| Challenges | Never alone             |   70 | Double-encounter chance +8 percentage points, capped at 33% |
| Challenges | Dry ink                 |   55 | One fewer well per floor                                    |
| Challenges | Restless pages          |   60 | Pursuer awakens at 12 revealed tiles, from floor 3          |
| Oddities   | Heavy pockets           |   90 | One extra treasure chest per floor                          |
| Oddities   | Leave a light on        |   75 | One extra beacon per floor                                  |
| Oddities   | Travelling market       |  100 | Shop spawn probability 60% per floor                        |
| Oddities   | Both ends sharpened     |   80 | Hero damaging rolls +1 damage; enemy base damage +1         |

The three Ranger enhancements require the invitation. Provisions and challenges
can coexist: for example, an extra well and Dry ink cancel one another. All
options have actual gameplay hooks, not preview-only controls.

## Ranger

Rangers start at 30 HP, with blade attacks, some poison, stun and block, plus
ordinary upgradable EMPTY faces. Exactly one **Aim** face appears on their
middle reel. Aim stores `4 + ceil(level / 2)` damage (plus Patient aim, if enabled),
up to 18. A later damaging roll releases all previously stored power as bonus
damage before its critical multiplier. If Aim and damage land together, existing
power is released and the newly gained power waits for another roll. Stored
power expires after battle. A hoverable bow badge shows the remaining amount.

Notched Longbow (+2 damage) and Scout Cloak (1 resistance, 2 opening team block)
are matching Ranger equipment. They only enter loot pools in Ranger-unlocked
expeditions. Starting as a Ranger requires the separate campfire purchase.

## Save design and recovery

- `game/progression.js` owns the stable unlock IDs, catalogue, validation,
  transactions and camp UI. `tools/build-ui.cjs` embeds it into the standalone
  HTML; never edit its generated HTML region directly.
- `scratchpad-dungeon-camp-v1` stores profile version 1, bank balance, purchased
  IDs, enabled IDs and the deposit ledger. It is independent of the expedition
  and preference keys. New run never deletes it.
- Expedition save version 13 adds a unique `runId`, `bankedFloors` and a snapshot
  of enabled `runRules`. Versions 1–12 still migrate; old expeditions start
  without new modifiers and retain their wounds, equipment and edited reels.
- A deposit is keyed by `runId:floor`. The profile write commits the transaction
  before the expedition is updated. If the expedition write is interrupted,
  loading subtracts each committed, unacknowledged deposit exactly once and
  records its acknowledgement. Repeated clicks cannot deposit again.
- Purchases re-read and validate the latest profile, prerequisite and balance
  before writing. Costs, deposits and balances must be safe nonnegative integers.
  Failed profile writes leave carried gold and purchases unchanged. Corrupt
  profile records are reported and not silently overwritten by a transaction.
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
