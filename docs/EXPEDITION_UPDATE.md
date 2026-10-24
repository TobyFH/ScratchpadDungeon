# Expedition economy, reels and notebook pages

This is an update to the existing self-contained game, not a new packaging or
production-infrastructure system. `index.html` remains the offline distribution.
The canonical pencil style, uploaded recordings, keyboard/mouse controls and
explicit event confirmations are retained. Rebuild embedded source changes with
`npm run build:ui`; `npm run check:ui` catches stale generated regions.

## Source map

| Source                                                       | Responsibility                                                               |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `game/economy.js`                                            | Designer-facing shop spending constants, price calculation, camp rank lookup |
| `game/progression.js`                                        | Stable camp purchase IDs, costs, prerequisites, banking and camp navigation  |
| `game/hero-builds.js`                                        | Class pool, equal starting faces, temperament, Execute, shared enemy shields |
| `game/reel-upgrades.js`                                      | Shared edit validators/prices, paid weighting, exact critical odds, workshop |
| `game/battle-tactics.js`                                     | Stun recovery, Vulnerable/passives, Graphite Gaoler blackout                 |
| `game/world-events.js`                                       | Paired tunnel generation/use and optional travel discoveries                 |
| `game/encounter-journal.js`                                  | Bestiary catalogue, encounter/death receipts, returned companions            |
| `game/encounter-presentation.js`                             | Confirmed arrivals, late badge emphasis, cosmetic identities and cries       |
| `ui/notebook-pages.js`                                       | Modal suspension/restoration, separate portrait motion, fixed loot browser   |
| `ui/field-guide.js`                                          | Short, fixed-navigation notebook topics                                      |
| `ui/combat-feedback.js`, `ui/drawings.js`, `ui/notebook.css` | Effects, species remains, terrain and reusable presentation                  |
| `index.html` outside generated blocks                        | Main state/lifecycle, movement, floor repair, combat, autoplay               |

## Economy

Gold-income formulas and banking percentages have not changed. Spending costs
are raised. All supplies and variants resolve through `shopPrices()`; its
`ECONOMY` and `SUPPLY_PRICE_PREMIUM` constants are the spending source of truth.
Autoplay pays these same prices. Shop affordability and full-bag checks still
happen before payment.

For floor `d`, quality `q` and living party size `n`:

- Ordinary supply: `80 + 12*d + 35*(q-1) + familyPremium`.
- Equipment: `170 + 18*d`.
- Full-party heal: `round((120 + 30*d) * (1 + .3*max(0,n-1)))`.
- Stair map: `90 + 16*d`; marking stairs does not prompt descent.
- Rare travelling cartographer: `round(.8 * basicTonicShopPrice)`.
- Family premiums: Unbroken page +70, salve +45, cinder +25, venom +30;
  oil/ember/frost +15, chalk +10, antidote −15, ration/bandage −10; others zero.

### Income sanity check

An analytic comparison used the unchanged loot reels with no gold artefact:
four ordinary solo fights, three chests and one ordinary guardian reward per
floor. It includes critical probabilities. This is a spending baseline, not a
claim about every generated run: elites, more fights, events, actual criticals,
rounding and the special final-victory payout vary.

| Floor | Mean ordinary fight | Mean chest | Approximate baseline floor income | Basic tonic | Solo full heal | Stair map |
| ----: | ------------------: | ---------: | --------------------------------: | ----------: | -------------: | --------: |
|     1 |                20.1 |       30.9 |                             213.5 |          92 |            150 |       106 |
|     4 |                40.3 |       51.0 |                             394.7 |         128 |            240 |       154 |
|     7 |                60.4 |       71.2 |                             575.9 |         164 |            330 |       202 |
|    10 |                80.5 |       91.3 |                             757.1 |         200 |            420 |       250 |

Camp purchases now cost hundreds/thousands. Ranger costs 900; Berserker costs 750. The starting-gold provision grants 150 instead of 20. Five health-training
tiers grant +10% through +50% base HP, with three damage and three EXP tiers.
Training applies automatically on future expeditions; optional modifiers remain
toggleable. See [Camp progression](CAMP_PROGRESSION.md) for every cost and stable
ID. This creates room for incremental progress without making completion depend
on buying training or changing the requested enemy-difficulty curve.

## Reels: equal faces and paid weighting

A hero rolls three independent reels. Each outer reel initially has six physical
faces; the middle has the same six plus its unique class mark. **Every initial
face has weight one**: 1/6 (16.67%) on outer reels, 1/7 (14.29%) in the middle.
Rank-I, rank-II and rank-III versions are separate faces, not a single weighted
symbol. Identical edited faces add their probabilities together. Enemy and
special event reels retain their deliberately authored distributions.

| Hero            | Six ordinary starting faces, repeated on all three reels |
| --------------- | -------------------------------------------------------- |
| Tank            | Blade I, Blade II, Block I, Block II, Heal I, Empty      |
| Rogue           | Blade I, Blade II, Blade III, Poison I, Block I, Empty   |
| Ranger          | Blade I, Blade II, Poison I, Block I, Stun I, Empty      |
| Berserker       | Blade I, Blade II, Heal I, Heal II, Blood Price I, Empty |
| Aggressive Mage | Magic I, Magic II, Poison I, Heal I, Block I, Empty      |
| Defensive Mage  | Heal I, Heal II, Block I, Magic I, Poison I, Empty       |

Mage temperament influences its initial faces, but is not a selected Mage role.
Recruited/edited heroes can naturally develop other builds. Legacy Healers keep
healing-oriented faces on conversion.

**Weight this face +1** buys additional draw weight for that face only. Successive
costs are 4, 8 and 12 personal points, maximum weight four. A class mark costs
6, 12 and 18. Example: weight one → two on a six-face reel makes its chance
`2/7 = 28.57%`; each unweighted face becomes `1/7 = 14.29%`. This does not add a
window or make the effect stronger. Power/symbol edits retain paid weighting.
Weighting has no refund; tier downgrades retain their existing half-cost refund.
The one middle class mark cannot be copied, swapped, downgraded or removed.

The workshop's **Critical odds** page enumerates meaningful type-and-rank combos.
For each matching symbol `t`, with independent reel distributions `P0,P1,P2`:

`criticalChance(t) = P0(t) * P2(t) * (P1(t) + P1(class))`

The class mark completes matching outer symbols and still casts its ability.
Rows are mutually exclusive, so their sum is the total per-roll critical chance.
Blanks, misses and an isolated class mark are excluded. All displayed chances
come from the actual current reels, including duplicate faces and paid weights.
Fully safe trap results never launch a zero-damage critical.

On compact screens, a native face selector replaces the desktop face list.
Fixed **Power**, **Replace** and **Weight odds** operation pages expose the same
validated edits while keeping readable type and stationary controls. Edit/critical
pages share a grid sized to the larger page, keeping the explanatory note and
Done control below actual content rather than an undersized fixed-height box. Manual play
and Autoplay share validators, prices and actual weighted expectations.

## Combat and encounters

- Ranger gains two patience for each party action without attacking, or three
  on its own nondamaging seal, capped at six. Execute bonus is
  `ceil((3 + .75*level) * charge/6 * (.5 + 2.5*missingHPFraction) * sealBoost)`;
  `sealBoost=1.35` if its seal also landed. It consumes charge on damage.
- Stun recovery checks after actual combat rolls and on a missed stunned attempt
  have 25%, 55%, 90%, then 100% chance: mean 2.12 checks. A roll cannot clear the
  stun it just applied. Missed hero attempts neither advance nor reset enemy
  countdowns. Healing still cleanses, and all combat statuses clear at the end.
- Poison stops immediately when either side has no living members. A final
  critical/Execute cannot be followed by an otherwise avoidable poison death.
- Each faction owns one block pool. Solo enemy protection stays below the
  portrait; a dual encounter has one larger row above its roster. Party block
  replaces the duplicate internal party title. Intercepted attacks target the
  shield; only actual HP overflow also hits the recipient.
- The floor-six guardian, **The Graphite Gaoler**, pencils out up to
  `livingPartyCount+1` available individual hero reels on arrival and can repeat
  every third enemy turn. A covered reel rolls EMPTY and is erased when its own
  hero acts. The passive can also occur on rare ordinary Gaolers at floors 6–10.
- An earlier-floor fallen hero has a 4.5% chance to replace the first ordinary
  enemy on a later floor. Each memorial can return once. This is an enemy zombie,
  not revival: the fallen record is unchanged and remains in final statistics.
- Appearance confirmations show every enemy before transferring the sketches.
  Badge emphasis happens afterwards. Vulnerable, Second wind, summoning,
  fracturing and pencil blackout use distinct themed callouts. Separate portrait
  talk/attack/flinch/death motion has a persisted 0–150% slider; zero and reduced
  motion disable it without removing gameplay or changing outcome RNG.

## Terrain and exploration

Lava is impassable and drawn as jagged cracked basalt. Generation places it
without disconnecting the walkable floor; final stair repair and version-18 load
repair preserve a route. Stairs remain at least eight moves from spawn in new
floors. Bridges show pale blue water beneath traversable wood.

A floor has a 14% chance to attempt paired tunnels. Of those, 8% attempt two
pairs; all others one. Ends are reciprocal, connected, at least three Manhattan
cells apart, and never overwrite an event, bridge or structure. Entering an end
prompts use/ignore. Teleport reveals/visits the far end without recursively
prompting; both ends remain active. Known ends are ignored on pass-through.

The invisible old-passage ambush clock is retained: only explored, nonbarrier
cells age; proximity resets age before it matures, combat/dialogs pause time,
and aged resolved cells can ambush. Victory clears adjacent age without revealing
hidden cells. Healthy Autoplay more willingly seeks visible low-risk fights for
EXP. It does not inspect hidden event data.

The chasing Unwritten moves for each player step. If it enters a **revealed,
live trap**, the hunter is removed and the tile becomes treasure. This awards no
immediate gold, EXP or battle victory; later collecting the tile rolls loot.

## Utility pages, fixed presentation and persistence

Options, Field guide and Bestiary tabs always remain clickable. Opening one
suspends the current animation/action. The original modal's nodes, attributes,
focus and callbacks are kept in a `DocumentFragment` and restored on close.
Combat, movement, automatic decisions and transient critical holds wait until
it closes. An options page must never silently confirm or discard an event.

Guide bodies share a reserved grid cell, so every page's navigation stays put.
Camp balance, tabs and card region also reserve their geometry. Treasure has
fixed artwork, main-machine, inline-critical, result and loot regions; changing
marks never changes machine width. The critical region starts blank. Its original
value becomes the final value in one fixed readout, without a calculation grid.
Both chest and battle-skull art use the full reserved row for centring. Multiple finds use a stationary reward
browser. Well art is larger/centred. All ranks use the same centred icon grid.

The bestiary contains 37 records, including ten separate guardians. Unknown
records show no creature name/stats/art or usable cry. Meeting an enemy records
its observed HP, damage, strikes, frequency, depth, passive and lore; clicking a
known sketch plays its cry. Stats are observations, not promised future enemy
values. Pun mode changes the displayed identity without changing the record ID.

`scratchpad-dungeon-bestiary-v1` stores discoveries independently of the camp,
settings and current run. Bounded encounter/death ID receipts prevent repeat
counts when an encounter is reloaded before the expedition save acknowledges
it. Legacy ongoing encounters backfill their correct species/guardian record.
Storage-write failures report to the console without blocking combat. Downloading
HTML exports the game only, not local-storage records; back up all four keys to
retain the run, camp, preferences and bestiary elsewhere.

Expedition version **18** migrates older authored hero weights to one while
retaining edited powers, ranks, points, equipment and wounds. New paid weights
persist. Existing camp purchases keep stable IDs at no additional charge. Lava
is made impassable and its staircase route repaired. Temporary fields are
normalised. Existing characters are not removed when a class becomes locked.

## Verification

Run `npm test` for the full real-browser and data suites, then `npm run review:ui`
for desktop, 1280×800 and compact notebook captures plus a playable HTML backup.
`tests/expedition-update.test.cjs` covers the new mechanics: equal odds and
migration, paid weights and exhaustive critical enumeration, spending/training
prerequisites and persistence, class gating, stun distribution, lethal poison
ordering, Gaoler blackouts, species remains, one thousand lava-safe maps, tunnel
distribution and use, hunter traps, zombies, journal receipts/cries, suspended
modal actions, exact reel centring, fixed treasure geometry, compact editing,
portrait settings and stable guide/camp navigation. Existing tests continue to
exercise the established combat and exploration rules. The five supplied WAV
recordings remain byte-for-byte embedded in the standalone game.

The subsequent [combat feedback update](BATTLE_TACTICS.md) adds Berserker
Bloodrush recovery/Fury lifesteal, poison-specific feedback, automatic reading
holds and blackout smoke. Bridges now use the same faded river path under the
wooden deck in an independent terrain layer; visiting or resolving a discovery
never fades that layer. No save-version bump or edited-wheel replacement is
needed for these changes.
