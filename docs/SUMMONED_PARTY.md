# The Necromancer's bound party (save 25)

This replaces the automatic Skeleton/bodyguard rules from save 24. Necromancer
availability is unchanged: defeat floor ten to earn it, never purchase or recruit
it. Living adventurers still fear the Necromancer and always fight.

## Actor ownership

The Necromancer and up to two bound summons are actual entries in `state.party`.
`isSummon()` identifies a bound actor by `summonOwnerId` and `summonKind`.
`summonsOf(master)` is the only live collection; do not restore a second
`master.skeletons` array. Summons use ordinary `spin()`, enemy countdowns, shared
block, target selection, criticals, ailments, healing and keyboard controls.
There are no automatic attacks and no bodyguard interception. Enemies choose
the master or a summon through the ordinary party-targeting rules.

The player confirmed that generated reels are **fixed**, not editable. Summons
have no personal points, equipment, independent experience or earned traits.
The master keeps normal advancement. Class names describe the summon build;
they do not make its generated class mark editable.

## Five builds

`SUMMON_TYPES` in `game/necromancer.js` owns names, base HP, roles, face pools,
seals and passive choices. Reels differ within these pools, retaining one focus
mark and at least one damaging mark on each reel.

| Kind / name | Role | Base HP | Middle seal | Passive variants |
| --- | --- | ---: | --- | --- |
| `blade` / Boneblade | Physical damage, poison | 15 | Rend: physical damage and poison | Venom bones / First cut |
| `guard` / Graveguard | Team protection, heavy attacks | 25 | Grave Ward: strike and block | Thick bones / Soul ward |
| `wisp` / Hexwisp | Spell damage, poison, disruption | 13 | Cold Flame: spells and stun | Cold spark / Soul ward |
| `cantor` / Bonecantor | Healing and support for summons | 17 | Mending Chant: team healing and block | Grave medicine / Second wind |
| `bomber` / Powderghoul | Explosive damage | 18 | Boneburst: hit every enemy, then die | Overpacked / Thick bones |

HP grows by four per level, with the normal camp vitality multiplier. Each
summon stores a random level offset of −1, 0 or +1, clamped to level one. Its
level tracks the master's; growth increases maximum HP but **does not restore
missing HP**. Reels scale from their saved seed: their types and build stay
fixed, while ranks rise gradually, bounded to I–IV. Ordinary summon damage is
80% of its calculated power; criticals use the Necromancer's modest pool.

Soul wards/venom count that actor's own rolls. First cut and Second wind have
encounter receipts. These passives do not trigger from another party member's
roll or from a render. Temporary combat statuses still clear normally.

`ui/summon-art.js` provides five original pencil silhouettes and a class-based,
stitched zombie treatment, including fallen poses. Art and speech use no gameplay
randomness. Existing sound/particle controls and the pencil palette apply.

## Souls, healing and consumption

Soul capacity, Harvest and death recovery retain their existing tuning. A full
bar raises one random ally if a real party slot is empty. With all three actor
slots occupied, it keeps the existing team and restores 10% maximum HP through
Soul Surge. Excess from a single grant cannot chain multiple summons.

Ordinary heals, fountains and supplies work on summons. They still cannot heal
the Necromancer. A selected unhealable master is skipped when resolving an
ordinary ally heal; it can select an injured summon instead. Soul Harvest,
Soul Surge and **Consume** provide master recovery.

Every summon card has a Consume button. Its offered healing is:

`min(ceil(master.maxHp × .5), ceil(master.maxHp × .12 + summon.hp × .5))`.

Only actual missing HP is restored. Consuming a healthy summon is worth more
than consuming one near death. The player may consume at full HP to free a slot,
but the healing is then wasted. During combat this is one master action: it
forfeits opening bonuses, ages relevant effects and advances enemy clocks once.
The Necromancer must be ready, not stunned or denied its opening action.
Outside combat it takes no battle turn. Busy/modal/run guards prevent double
activation or an old action modifying a new run.

Summon deaths, Boneburst and consumption do not grant free death healing/Souls,
open burials or use Revive Stones. They enter a bounded `summonArchive` for
combat totals and lingering poison/Seed attribution. Dead actors stay in their
slots until a safe action boundary, preserving indices throughout multi-hit
rolls and enemy turns. `pruneSummons()` then removes them and repairs the healing
target by identity. Master death ends the run immediately and dismisses every
remaining summon.

## Returned adventurers

Defeated hostile adventurers leave a bounded, saved `necromancerVictims` receipt
with their name, class and old face types. Eligible current-run memorials can
also supply a body. Once a body exists, a new summon has a 25% chance to use one.
Each body returns at most once. This does not revive a normal companion, erase a
memorial or introduce a recruit offer.

The zombie retains its name, class and general face mix, but its HP and ranks
use the same current-master-level rules as other summons. Its generated reels
remain fixed. Original high ranks are not copied into an early-level zombie.

## Persistence and automation

Save 25 migrates live `master.skeletons` into bound Boneblades. IDs produce
deterministic build seeds; migration does not spend gameplay RNG. Existing
wounds, Souls and damage statistics remain. Reloads do not reroll faces, passive
choices, level offsets or raised-body receipts. Non-Necromancer saves also keep
their normal party, progress and settings.

Autofight may choose any ready bound actor and consumes an expendable summon
when the master is endangered. Autoplay can do the same outside combat. Neither
driver edits or equips summons; both use the same validators as manual controls.
Healing supplies remain useful for injured summons without becoming master heals.

## UI fixes shipped alongside this rework

- `openModal()` reuses an existing shop title on purchase redraws. The deliberate
  stair-map announcement remains animated; ordinary purchases never restart it.
- `ui/summoned-party.css` owns the compact healing strip: three reserved portrait
  hitboxes, only occupied ones visible, plus the current target name/HP. Missing
  heroes do not stretch the remaining buttons. The selected tick and green
  outline remain. Shift+1–3 still selects the same targets.
- Summon cards show ordinary HP, reels, their role/passive and Consume. Compact
  cards use a focusable passive icon with a tooltip, leaving room for Consume.

## Validation and maintenance

`tests/necromancer.test.cjs` covers the manual action economy, all five builds,
fixed editing/equipment, direct enemy targeting, healing/consumption, Boneburst,
passive receipts, zombies, legacy migration, persistence, master death,
automation, shop title continuity and desktop/compact UI. The existing earned
unlock tests remain in `tests/polish-update.test.cjs`.

Run `npm run build:ui`, `npm test` and `npm run review:ui`. Inspect captures in
`test-results/summoned-party/`, including 1920, 1280, 390 and 320px. Keep the
built `index.html` self-contained, and commit it with its source changes.
