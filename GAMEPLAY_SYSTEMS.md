# Gameplay systems and automation

The distributable remains one offline `index.html`. Gameplay definitions and
functions live in its non-generated script. UI sources remain in `ui/`; rebuild
with `npm run build:ui` after presentation edits. There is no new runtime package,
external AI service or separate data file required to play.

## Shared balance definitions

- `ENEMY_PROFILES` gives each species a health multiplier, explicit face pool and
  thematic passive. Repeated faces are weights. `enemyReels()` promotes those
  faces by depth; final guardian attack/magic faces are IV and support faces III.
  `enemyBalance()` keeps the depth curve separate from species identity.
  Normal enemies use species HP multipliers; staircase bosses retain a strictly
  rising depth HP curve and differ through their reels and passives.
- `CLASS_PRICES` multiplies base `FACE_COST` by the destination symbol's affinity.
  `faceUpgradeCost()` and `faceEditCost()` are authoritative. `applyFaceEdit()`
  validates and spends personal points, retains weights, clamps tiers and keeps
  at most one class seal on the middle reel. The editor, automation and recruited
  heroes use these prices. Do not introduce a cheaper automated edit path.
- `ITEM_POWER` stores base consumable effects; `ITEM_DEFS` carries those effects
  and the user-facing descriptions. Supply variants are generated once, with
  stable `family_quality` IDs and fixed values. `lootItemForDepth()` selects the
  quality when finding/buying an item, never when using it. Existing stacks do
  not silently improve as the player descends. Equipment uses `EQUIPMENT_DEFS`.
- Affinities encourage specialties without forbidding off-role builds. Tanks
  favour blades, shields and stun; healers healing, shields and stun; mages
  magic, poison and stimulants; rogues blades and poison. Stronger upgrade tiers
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
frontier goals; their concealed walls/events never affect priority. Visible
useful treasure, companions and beacons can take precedence over stairs. Active
wells are sought when the weakest hero is below 48% or the party is missing 28%
of total HP. Routes still penalise active fights and traps. Shops and declined
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

## Combat presentation and cleanup

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

Version 11 loads older saves, retaining wounds, personal points, edited hero
reels and base supply IDs. Enemy powers/traits can refresh under the new rules;
ongoing enemy HP is retained. Out-of-combat temporary statuses are cleaned up.

`floorSnapshot()` captures cumulative roster totals at entry. It deduplicates
living, retired and fallen members by ID, so death doesn't erase their work.
`recordFloorClear()` stores one delta record per depth in `floorClears`.
`celebrateFloorClear()` requires confirmation and adds paper/confetti fanfare.
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
