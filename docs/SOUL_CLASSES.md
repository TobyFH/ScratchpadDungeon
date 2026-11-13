# Blood Seeds and the Soul Collector

> Current save-26 Seed, shield, stimulant, temple, UI and update rules are in
> [PAPER_INTERACTIONS.md](PAPER_INTERACTIONS.md), which supersedes conflicting examples below.

Blood Seeds retain their save-24 mechanics; Necromancer uses the later
[save-25 bound-party rules](SUMMONED_PARTY.md). These replace the Bloodbinder's former
timed Bleeding, Clotted and percentage Blood Exchange. The later
[notebook polish pass](NOTEBOOK_POLISH.md) adds earned Necromancer availability,
Seed maturity and normal-healing bonuses; it also documents the current Rogue,
temperament, enemy-budget and loot changes. Artwork is unchanged.

## Bloodbinder

The existing 1,200-gold invitation, 32 base HP and critical pool remain. Ordinary
faces are **ally heal, Blood Seed, spell damage, ally stimulant and Empty**.
Blood Seed is private to this class. One permanent middle seal casts **Blood
Bloom**; it cannot be removed or copied.

- A Seed face adds its tier's worth of Seeds to the selected enemy. Criticals
  increase the number planted using the ordinary class multiplier.
- From level 5, planting adds one extra Seed per roll; from level 9, two. This
  bonus applies once after critical multiplication, without an extra HP fee.
  Normal Bloodbinder healing gains 2.5% per level after level 4, capped at 20%;
  the fixed one-HP Seed pool is never multiplied by this bonus.
- Each rolled Seed face costs **ceil(tier / 2) caster HP**, paid once before
  critical multiplication: ranks I/II cost 1 HP; III/IV cost 2 HP. This bypasses
  block but stops at 1 HP. A caster already at 1 HP may still plant Seeds.
- Each enemy has its own reservoir. There is **no gameplay stack cap or expiry**.
  Completing combat clears it. Normalization accepts finite safe integer counts.
- Each point of actual HP damage consumes one Seed and releases one shared HP
  of healing. Shields, resistance and overkill cannot manufacture healing.
  Direct attacks, poison, Skeletons and damaging supplies use the same hook.
- Healing is allocated among injured living allies, lowest HP ratio first.
  One pool is shared, not duplicated per ally. Excess is lost. It uses exact
  shared healing, retaining Fury spending and health/stat feedback without camp
  or equipment multiplying the fixed pool. It never resurrects a fallen hero.
- **Blood Bloom** removes every remaining Seed on every living enemy. Each
  deals **1 piercing damage and releases 1 shared healing**, as confirmed by the
  player. Its healing is based on the number detonated, even if damage overkills.
  It cannot recursively consume itself, crit twice, cleave again or consume
  Vulnerable. Accompanying ordinary marks keep their normal critical rules.
- Newly rolled Seeds plant before that roll's spell damage and Bloom, so a mixed
  roll can immediately release them. Seed costs are paid only once.

Maroon drop bursts appear at separate randomized positions around the victim.
Green healing marks fly from that enemy to the actual recipients. Very large
counts use up to 18 labelled simultaneous bursts; this is a presentation bound,
not a limit on damage, stacks or healing. Pending flights finish before the
victory sheet replaces combat. The machine footnote shows target and total Seeds.

Autoplay retains legal spell damage and recovery alongside Seeds, rather than
treating an unused reservoir as automatic damage or endlessly planting without
an allied way to consume it.

## Necromancer: current bound-party rules

The [save-25 summoned party rework](SUMMONED_PARTY.md) is the current authority.
The earned Necromancer raises up to two **player-controlled** bound allies in
`state.party`. Boneblade, Graveguard, Hexwisp, Bonecantor and Powderghoul have
fixed generated reels, distinct art, passives and roles. Their level tracks the
master at a saved offset of −1, 0 or +1. They take ordinary chosen actions;
there are no automatic attacks or bodyguard interception.

Consume sacrifices an ally to heal the master, spending one action in combat.
Ordinary healing works on summons but not the master. Full-bar Soul Surge still
heals an occupied team, and enemy deaths still offer capped master recovery.
Defeated adventurers can return once as named zombies. The old `h.skeletons`
collection migrates without spending RNG or losing wounds/Souls. Master death
still ends the run. See the linked document for generation, balance and safety
contracts.

## Ownership and migration

- `game/bloodbinder.js`: reservoir counts, costs, allocation, detonation and AI
  forecast. All enemy HP losses enter through shared `damageEnemy()`.
- `game/necromancer.js`: Soul tuning/lifecycle, Skeletons, interception and
  restricted recovery. Summons are bound actors in `state.party`, with fixed seeded builds.
- `game/hero-builds.js`, `game/reel-upgrades.js`, `game/auto-builds.js`: shared
  permissions, faces, paid editing and AI preferences.
- `ui/soul-feedback.js/.css`: meters, auxiliary rows and ephemeral effects;
  `ui/drawings.js`: the pencil Necromancer portrait and Harvest mark.
- Authored `index.html`: integration in the normal spin, damage, enemy-turn,
  recruitment, death and save paths. `tools/build-ui.cjs` embeds modules into it.

Save 24 converts old Bleeding into a Seed count of damage × remaining turns,
keeps its source owner and removes retired Clotted. Bloodbinder physical marks
become spells, self stimulants become ally stimulants, and self heals become
ally heals; tiers and paid receipts remain. Other forbidden marks become Empty
without adding refunds or losing paid receipts. There is no save reset.

## Verification

`tests/bloodbinder-balance.test.cjs`, `tests/bloodbinder-update.test.cjs` and
`tests/necromancer.test.cjs` exercise real browser rolls, costs, shared pools,
critical/overkill/shield handling, private faces, paid edits, enemy-death hooks,
manual summon turns, consumption, targeting, healing restrictions, immediate defeat, recruitment, persistence
and desktop/compact layouts. New class captures are in ignored
`test-results/soul-classes/`. Run `npm test`, `npm run review:ui` and rebuild
`index.html` after source edits.

Summon tuning and the current browser coverage are documented in
[Summoned party](SUMMONED_PARTY.md).
