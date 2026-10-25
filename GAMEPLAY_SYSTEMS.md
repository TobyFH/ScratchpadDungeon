> Current build, opening, status, terrain and reward rules are documented in
> [Battle tactics](docs/BATTLE_TACTICS.md) and the version-18
> [Expedition update](docs/EXPEDITION_UPDATE.md). Equal-face reels/paid weighting,
> training prices, stun recovery, tunnels, blackouts and bestiary rules there take
> precedence over historical notes below. Embedded sources extend the core
> runtime; historical implementation notes below should be read with those rules.

# Gameplay systems and automation

The distributable remains one offline `index.html`. The core runtime lives in
its non-generated script; hero builds, reel editing, encounter
presentation and camp progression are embedded from `game/`. See
[Combat builds](docs/COMBAT_BUILDS.md) for the current module contracts. UI sources remain in `ui/`; rebuild
with `npm run build:ui` after presentation edits. There is no new runtime package,
external AI service or separate data file required to play.

## Shared balance definitions

- `ENEMY_PROFILES` gives each species a health multiplier, optional damage multiplier, explicit face pool and
  thematic passive. Repeated faces are weights. `enemyReels()` promotes those
  faces by depth; final guardian attack/magic faces are IV and support faces III.
  `enemyBalance()` keeps the depth curve separate from species identity.
  Normal enemies use species HP multipliers; staircase bosses retain a strictly
  rising depth HP curve and differ through their reels and passives.
- `CLASS_PRICES` multiplies base `FACE_COST` by the destination symbol's affinity.
  `faceUpgradeCost()` and `faceEditCost()` are authoritative. `applyFaceEdit()`
  validates and spends personal points, retains weights, clamps tiers and keeps
  one permanent class seal on the middle reel. The editor, automation and recruited
  heroes use these prices. Do not introduce a cheaper automated edit path.
- `ITEM_POWER` stores base consumable effects; `ITEM_DEFS` carries those effects
  and the user-facing descriptions. Supply variants are generated once, with
  stable `family_quality` IDs and fixed values. `lootItemForDepth()` selects the
  quality when finding/buying an item, never when using it. Existing stacks do
  not silently improve as the player descends. Equipment uses `EQUIPMENT_DEFS`.
- Affinities encourage specialties without forbidding off-role builds. Tanks
  favour blades, shields and stun; Mages can specialise in healing, shields,
  magic or poison; rogues favour blades and poison. Stronger upgrade tiers
  retain their existing rising base prices. Blank inscriptions still cost three.

## Automatic decisions

Autoplay and Autofight are independent, persistent opt-in settings. User-opened
menus pause exploration; disabling Autoplay interrupts after the current step.
Neither driver dismisses the final run summary or bypasses the starting choice.

`expectedHeroEffects()` reads each hero's **actual edited weighted reels**,
including class-seal effects and approximate critical chances. `autoCombatScore()`
compares useful damage, missing HP, incoming threat, remaining shared block and
status coverage. Stunned actors are avoided when somebody else can act. It is
an estimate, so it deliberately does not predict upcoming rolls.

`autoChooseActor()` limits consecutive non-damaging support spins to two (three
below 20% HP) before choosing an attacker. A stunned attacker can spend its
missed action to recover rather than leaving a heal-only actor spinning forever.
`recordAutoCombatProgress()` tracks damage and the lowest remaining enemy
HP-plus-block; five stagnant spins also favour offence. With no damaging wheel
it tries an offensive supply, otherwise pauses Autofight with an explanation.
Sixty spins without progress also pause for manual intervention. This safety
limit is not a guaranteed-win solver and never gives heroes free damage.

`autoItemPlan()` picks a valid recipient and useful consumable; efficient healing
or emergencies are favoured, existing poison/buffs are not needlessly repeated,
and known wells conserve healing supplies. Offensive supplies and protection
have a normal three-action cooldown; an emergency can override it. Equipment is
only accepted when it fits the class and strictly improves the assigned score.
This prevents bag/returned-equipment loops. Overflow decisions compare stack
utility and acquired quality, and can use or replace supplies without adding a
fourth pocket. `autoShopButton()` buys affordable useful stock and then leaves.

`autoUpgradeHero()` evaluates legal edits for benefit per actual point cost. It
inscribes blanks and favours each class's role, including critical consistency.
A bounded loop prevents a damaged save with excessive points from hanging the
browser. It never edits a class seal away. Recruit replacement values levels,
role diversity and healer coverage rather than replacing a companion on a tie.

`autoplayGoal()` only reads the contents of **seen** tiles. Hidden tiles are
frontier goals; their concealed walls/events never affect priority. Public
`DISCOVERY_HINTS` text can affect priorities: seek hinted water while wounded,
treasure/recruits when useful, and avoid hinted hazards. This inference uses the
visible text, never the hidden event or terrain. Visible
useful treasure, companions and beacons can take precedence over stairs. Active
wells are sought when the weakest hero is below 60% or the party is missing at
least 28% of total HP. `autoNeedsWell()` is shared by travel and the drink/decline
choice. Once the guardian is beaten, any missing HP makes the nearest reachable
unused well take precedence over stairs, regardless of route length. This
also closes an already-open descent sheet to return for recovery. Routes still penalise active fights and traps. Shops and declined
ruins carry a per-floor decision marker to avoid revisiting them endlessly.

Use `applyFaceEdit`, `useItem`, `equipCharacter`, `buyShop`, `equipArtefact`,
`move` and existing event-choice buttons. Don't mutate HP or add free upgrades
inside an AI planner. Async prompt handling must run before automation's action
lock: a travel/equipment promise can be waiting for that very prompt. Combat
item cinematics must also be handled by Autofight when Autoplay is off.

## Enemy passives and pursuit

`assignEnemyTrait()` grants thematic passives to bosses/strongholds from floor
3, some elites and ordinary hard enemies from floor 7. Traits persist with the
enemy. `resolveEnemyWoundTrait()` handles one-time recovery or a smaller second
form before victory checks. `tickEnemyPassive()` advances once per enemy turn,
not once per strike, and only summons into an available second slot. Summons
have no passives and do not steal a staircase boss's reward/progression flag.
Always check the current living roster for victory, not a cached pre-roll list.

`move()` calls `advancePursuer()` after **every completed player step**, including
long and redirected paths. Pursuit takes one route step per call. Animation pace
changes presentation, never the relative number of player/pursuer steps.

Additional species have explicit `minDepth`/`maxDepth` ranges in `ENEMY_PROFILES`:
Tallow moth 1–3, Rust mite 2–5, Spore pilgrim 3–6, Mirror hound 5–8 and Ash
colossus 8–10. Their health/strike multipliers and thematic reels vary independently
of the global depth curve. Their carapace, recovery and split traits use the
existing eligibility rules above. The Unwritten's health multiplier is 1.28
(previously 1.15) and strike multiplier 1.12; its pursuit cadence is unchanged.

## Combat presentation and cleanup

`damageHero()` owns the precise post-resistance/block damage calculation. For
an enemy attacker, blocked segments beam to the mounted team-shield SVG;
positive HP damage additionally beams to the hero. Critical base/bonus segments
each repeat that interception. `renderBlock()` updates the value without replacing
the shield node while impacts run. Its `--block-strength` is `min(block,20)/20`,
driving blue-silver ink and paper tokens; the actual pool is never capped.

`healingTarget()` only redirects single-target actions whose selection is full
(or no longer alive). It picks the living wounded hero with lowest **raw** HP.
The roll and item-use paths share it; consumable availability uses it too.
Partially wounded targets retain the complete roll/item, wasting excess normally.
`healHero()` itself never redirects, so party heals, wells, shops and floor
recovery cannot repeatedly concentrate their per-hero grants onto one hero.

Hero card background/name/HP clicks and Enter/Space activate its reels. Nested
portrait, equipment, edit and reel controls keep their explicit actions.
`heroStatsMarkup()` shows battle-focused values in combat and live lifetime values
outside combat, sharing
`HERO_STAT_LABELS` with the final roster. Nested status/trait badges take priority.

`syncStatusFX()` derives low/critical HP and poison/buff classes from live state.
`partyCardFeedback()` supplies transient whole-card hit, heal, roll, poison and
shield pulses without changing geometry or consuming gameplay randomness.
Poison uses the shared purple tokens, rivers restrained blue tokens; numeric HP
and labelled status badges remain essential non-colour information.

The hero lever's entire stationary hitbox stays inside its reel/caption row.
The EXP bar and editor row follow it; compact spacing must fit inside fixed
cards. Browser layout tests check those actual bounds, not just visible reels.
`clearBattleStatuses()` clears poison, stimulant, rage, stun and stun grace from
all combatants, updates portraits and removes stale status labels at battle end.

## Floor records and saves

Version 17 loads older saves, retaining wounds, personal points, edited hero
reels and base supply IDs. Enemy powers/traits can refresh under the new rules;
ongoing enemy HP is retained. Saved Unwritten encounters refresh health and damage
once, preserving their remaining HP fraction; the migration runs after older
enemy migrations. Autofight's transient progress counters restart on reload.
Out-of-combat temporary statuses are cleaned up.

`floorSnapshot()` captures cumulative roster totals at entry. It deduplicates
living, retired and fallen members by ID, so death doesn't erase their work.
`recordFloorClear()` stores one delta record per depth in `floorClears`.
`celebrateFloorClear()` requires confirmation and adds paper/confetti fanfare.
`celebrationFireworks()` adds six radial paper-spark launches; victory uses
eighteen larger launches. The first burst is synchronous so Skip retains it;
later callbacks require the same run and visible panel. Particle budgets are
bounded and use `fxRandom()`, never gameplay RNG.
The final boss retains immediate end-of-run victory, with final floor statistics
included after the adventurer entries in the existing scrollable records. A legacy save without a baseline starts counting at
load; it cannot recover earlier per-floor activity. Gold is labelled **net**
because purchases are included. The next floor snapshot starts after descent's
existing five-HP recovery.

## Verification

`npm test` covers ordinary rules, previous save versions, complete campaigns,
automatic campaigns, and focused decisions/costs/items/passives/pursuit tests.
`npm run review:ui` produces desktop, Steam Deck-sized and phone captures plus
an offline HTML backup. Review status colours, EXP/lever/editor spacing and long
variant names in all palettes; numeric bounds alone do not prove readability.

## Preferences, audio and lighting (version 12)

`DEFAULT_PREFERENCES`, `normalisePreferences()` and `setPreference()` are the
shared settings contract. Preferences are saved both with progress and in the
independent settings record, and survive a new expedition. Numbers are clamped;
unknown enum values and invalid booleans fall back to defaults. Brightness is
50–150%, shake 0–150%, volumes 0–100%. Zero shake returns before creating an
animation. Lighting uses a non-interactive viewport overlay, so brightness does
not move fixed dialogs, tokens or hitboxes. Torchlight is independent of gameplay
particles and can be switched off; reduced-motion preferences suppress flicker.

`screenFX()` is the separate full-screen event-feedback layer. The persisted
`fullScreenEffects` boolean defaults on. Wounds/traps use red, poison purple,
healing green and gold/criticals gold, from existing palette tokens. Its fixed,
pointer-transparent edge mask leaves the centre clear. A new effect cancels the
previous one; toggling off cancels active animation immediately. Reduced motion
reduces opacity and duration; Skip still gives brief feedback. No effect consumes
gameplay RNG, changes a delay or affects HP. The Display page keeps this toggle
beside Torchlight in a shared settings cell, so compact sheets still fit.

Options has Play, Audio, Display and Coming later pages. Controls use native
inputs and keyboard navigation; only one settings panel is laid out at a time.
Master, SFX, music, ambience, mute, brightness, shake, ambient lighting, animation
pace, critical presentation, palette, automation and browser fullscreen work.
Resolution, language, desktop window mode and quality are **saved previews**.
They intentionally do not change resolution, translate text or apply graphics
quality. Don't remove their visible preview explanation until implemented.

`GameSound` owns a single gesture-unlocked Web Audio context, separate gain
buses, a compressor, throttled cues and a maximum of 20 concurrent voice groups.
`SOUND_CUES` describes replaceable oscillator/noise sounds. `MUSIC_SCORE` holds
an original 64-step melody, four minor-key chord voicings and a .42-second step.
A lookahead scheduler layers filtered triangle plucks, sine bass and swelling
chords, with independent ambience. Resuming a hidden tab resets the scheduling
clock rather than trying to play missed notes. Music/ambience use at most twelve
voice groups to reserve capacity for effects within the overall twenty limit.
`CRY_PROFILES` defines distinct contour/pitch/wave/duration/roughness for every
enemy species and hero class. `GameSound.cry()` synthesises an appearance call
or lower, stretched death variation on the SFX bus. Encounters and summons call
on appearance; final enemy deaths call once, after any split/recovery passive.
Hero death recording calls once per death, including a later death after revival.
The five supplied WAV recordings are embedded from `ui/audio-samples.js`;
cries/music remain synthesised. No external downloads, paid services or gameplay RNG are used. Hidden tabs
suspend audio and resume it after earlier activation. Context startup failure
leaves the game playable. Chromium can defer idle gain-node evaluation; volume
tests play a cue before inspecting the active bus, rather than reading stale
idle values. Tune cues or replace synthesis in this module without changing the
combat call sites. Test actual audibility on speakers/headphones before treating
these temporary sounds as finished audio production.

`rollCritical()` always chooses and records the multiplier before checking
`skipCriticals`. The opt-in setting skips the critical machine, popup/inline
panel and hold. It keeps the same gameplay RNG, calculations, combat impacts and
ordinary event confirmation. This differs from Skip cinematics, which still
shows the critical result unless this new setting is enabled.

## Tier IV and mid-floor pressure

`maxFaceTier()` allows IV for attack, magic, heal, block, stun, poison and
stimulant faces; class seals remain I. Existing class prices apply to IV, and
save validation accepts every supported tier. Tier-IV attacks retain 11 base
power; healing is 8, the other support powers 4. Enemy promotion retains its own
attack-IV/support-III caps. Hero upgrades do not silently buff enemy reels.

Floors 3–6 add 2/4/6/8% HP through `enemyBalance()`. Floors 4–7 add one base
damage, then merge into the existing later curve; floor 7 bridges the transition
so floor 8 does not become weaker. Floors 1–2 and the final guardian's three
strikes/top-tier faces are unchanged. Earlier saved combats refresh damage but
retain existing HP, except pre-version-7 saves that already use HP migration.

## Hero traits

`HERO_TRAITS` is the authoritative set of 15 stable IDs and effects.
`beginTraitBattle()` records each living hero's start stats and lowest HP;
`traitCandidate()` identifies an eligible outcome. `awardTraitOccurrence()` gathers
eligible heroes for the whole occurrence, makes one 30% chance check and chooses
at most one eligible recipient. `evaluateTraitEvent()` wraps individual events
such as a single victim's trap. `grantTrait()` replaces one trait automatically,
without a dialog. A repeat of the same trait does
nothing. Replacements wait until eight further steps **or** two more victories,
limiting rapid feedback churn. The reason/depth/time stays with the hero and
in their death record. Hover/focus the portrait badge to inspect its effect and
origin. Traits survive combat cleanup; buffs, poison and stun still expire.

| ID          | Trigger                                                            | Minor effect                       |
| ----------- | ------------------------------------------------------------------ | ---------------------------------- |
| heroic      | Win a hard battle alone, staying above 30% HP                      | +1 damaging-roll power             |
| hardy       | Survive at/below 20% HP after taking at least 30% max HP in damage | Resist 1 damage                    |
| cowardly    | Win after reaching 20% HP while still stunned                      | +1 shield-roll block, −1 damage    |
| scarred     | Survive repeated critical wounds at/below 10% HP                   | Receive 1 less healing             |
| stoic       | Block at least 12 damage while taking less than 6                  | +1 opening team block              |
| merciful    | Heal at least 16 HP in battle                                      | +1 healing-roll power              |
| reckless    | At least 5 spins, 40 damage, under 40% HP, no healing given        | +2 damage, take 1 extra per hit    |
| venomous    | Kill an enemy with poison and survive                              | Poison lasts 1 extra action, cap 8 |
| haunted     | Win an ambush after falling below 40% HP                           | −1 damage                          |
| focused     | Successfully apply at least 3 new stuns                            | +1 stun-roll power                 |
| stubborn    | Take at least 15 damage and block at least 6                       | Resist 1 damage, −1 healing power  |
| wary        | Escape a trap without HP damage                                    | +1 opening team block              |
| scorched    | Survive trap damage of at least 15% maximum HP                     | −1 healing power                   |
| invigorated | Recover at least 20% maximum HP from a well                        | Receive 1 extra healing            |
| bookish     | Examine two beacons                                                | +5% EXP, fractions accumulate      |

Survival conditions have priority over role-based battle traits; the ordering is
explicit in `traitCandidate()`. Damage/healing penalties cannot turn an
otherwise positive effect negative (minimum 1); no healing bonus creates healing
on a blank roll. Trait effects never rewrite reels or consume randomness;
the occurrence chance and recipient selection deliberately use gameplay RNG.
Bookish fractions reset on replacement. Automated decisions include active
trait modifiers in their expected effects.

Enemy captions use `enemyActionText()` / `setEnemyPhase()`, independently of
passive labels. Idle clocks, rolling, attacks, poison, stun, healing, shields and
death get current captions. Transient phases are cleared on reload. The enemy
machine footnote is deliberately empty; its reserved height keeps layout stable.

## Camp and current encounter rules

See [docs/CAMP_PROGRESSION.md](docs/CAMP_PROGRESSION.md) for the independent
profile, stable unlock IDs, purchases, per-run rule snapshots and exactly-once
banking recovery. `game/progression.js` is a generated-inline source; build it
with `npm run build:ui`. Do not merge the camp balance into the replaceable run
save or spend it from autoplay.

`autoReadiness()` compares average party level against `1 + ceil(depth × .6)`,
expected combined wheel damage against `5 + depth × 2`, and the weakest/aggregate
health. When behind it prioritises reachable frontiers, rewards and recovery
before stairs, and can take ordinary fights for EXP while healthy. Shops with
remaining healing stock can be revisited when wounded. It ultimately commits
when no useful preparation remains. The heuristic only reads revealed events
and public discovery hints.
Autoplay banks 25% on nonfinal floor-clear sheets, once, through the normal
bank button; the tenth-floor victory banks its entire remaining balance
automatically through the same ledger, while final records stay open.

`doubleBattleChance()` is 2/7/13/18% on floors 1–4, then +1 percentage point per
floor (24% on floor 10). Bosses, strongholds and wandering ambushes use their
own encounter rules. `enemyHitPower()` maps offensive reel power to a bounded
base-damage fraction; enemy critical multipliers are 1.25/1.25/1.5/1.75, while
hero and event critical multipliers remain 2/2.5/3/4. The final guardian retains
three strikes, frequency one and tier-IV offence. Camp difficulty hooks apply
inside `enemyBalance()` so summoned enemies and migrations use the same rules.

Ranger now uses Execute rather than stored flat Aim damage. All build, refund,
Mage migration, shared-enemy-block, consumable protection and new feedback rules
are described in [docs/COMBAT_BUILDS.md](docs/COMBAT_BUILDS.md), with authoritative
source paths. Keep both player and automation paths on those shared operations.

`statusBadge()` is the shared source for live status explanations; hover and
focus share a viewport tooltip. Room descriptions derive from the current
revealed cell, nearby revealed water and floor environment, with no RNG or
hidden-event disclosure. Inspection controls keep their opacity while travel
disables interaction; round/team block are subdued and reset between fights.

## Version 21: biomes and class tuning

See [BIOMES_UPDATE.md](docs/BIOMES_UPDATE.md) for current formulas and migration.
`game/biomes.js` centralises named floor themes, directed slide/tunnel movement,
terrain generation and capped mushroom reveals. `game/biome-enemies.js` provides
depth-banded local species and the Powder imp fuse/detonation lifecycle.
`hero-builds.js` shares class/heal tuning, level-scaled Fury and Tank block across
actual rolls and estimates. Blood Price/Trick edits remain class-exclusive.
Autoplay uses paid class-identity repairs and charge-aware actor scoring; gold
criticals update the reserved final value and math at the same lock moment.
